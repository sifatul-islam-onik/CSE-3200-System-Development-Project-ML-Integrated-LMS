import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCamera, faUpload, faChevronLeft, faChevronRight, faCheck, faSpinner, faClock, faHourglassHalf, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { getTermExamMarks, saveTermExamMarks } from '../services/termExamMarksService';
import { submitOCRJob, getOCRJobStatus, getQueueStatus } from '../services/ocrJobService';
import '../styles/MarkEntry.css';

const MarkEntry = ({ course, students, section, onClose }) => {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [marks, setMarks] = useState({
    a: { '1': '', '2': '', '3': '', '4': '' },
    b: { '1': '', '2': '', '3': '', '4': '' },
    c: { '1': '', '2': '', '3': '', '4': '' },
    d: { '1': '', '2': '', '3': '', '4': '' },
    e: { '1': '', '2': '', '3': '', '4': '' },
    f: { '1': '', '2': '', '3': '', '4': '' },
    g: { '1': '', '2': '', '3': '', '4': '' }
  });
  // Store all students' marks and images
  const [studentData, setStudentData] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  
  // OCR job tracking (replaces sessionStorage and processingQueue)
  const [ocrJobs, setOcrJobs] = useState(new Map()); // studentId -> job object
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedMarks, setSavedMarks] = useState(null); // Track marks from database
  const [isProcessingImage, setIsProcessingImage] = useState(false); // Loading state for process button
  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for initial data
  const [activeJobCount, setActiveJobCount] = useState(0); // Track number of active jobs for efficient polling
  const [queueStatus, setQueueStatus] = useState(null); // Queue status from Redis
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null); // Separate ref for mobile camera input
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const currentStudentIdRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const ocrJobsRef = useRef(new Map()); // Ref for polling without causing re-renders
  const queuePollIntervalRef = useRef(null); // Separate interval for queue status polling

  const currentStudent = students[currentStudentIndex];
  
  // Detect if device is mobile
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // Update ref whenever current student changes
  useEffect(() => {
    currentStudentIdRef.current = currentStudent._id;
  }, [currentStudent._id]);
  
  // Sync ocrJobsRef with ocrJobs state
  useEffect(() => {
    ocrJobsRef.current = ocrJobs;
  }, [ocrJobs]);
  
  // Poll active OCR jobs with performance optimizations - only when there are active jobs
  useEffect(() => {
    if (activeJobCount === 0) {
      // No active jobs, clear any existing interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    
    const pollJobs = async () => {
      const activeJobs = Array.from(ocrJobsRef.current.values()).filter(
        job => job.status === 'pending' || job.status === 'processing'
      );
      
      if (activeJobs.length === 0) {
        setActiveJobCount(0); // This will stop polling via the effect
        return;
      }
      
      // Batch update all jobs
      const updates = [];
      for (const job of activeJobs) {
        try {
          const response = await getOCRJobStatus(job.jobId);
          if (response.success && response.data) {
            console.log('Job status response:', response.data);
            updates.push(response.data);
          }
        } catch (error) {
          console.error(`Error polling job ${job.jobId}:`, error);
        }
      }
      
      // Only update state if there are actual changes
      if (updates.length > 0) {
        console.log('Polling updates received:', updates.length, 'jobs');
        
        let hasChanges = false;
        const currentStudentUpdate = updates.find(
          job => {
            const isCompleted = job.status === 'completed';
            const isCurrentStudent = job.studentId === currentStudentIdRef.current || job.student?._id === currentStudentIdRef.current;
            console.log('Checking job:', {
              jobStudentId: job.studentId || job.student?._id,
              currentStudentId: currentStudentIdRef.current,
              status: job.status,
              isCompleted,
              isCurrentStudent,
              hasMarks: !!job.marks
            });
            return isCompleted && isCurrentStudent;
          }
        );
        
        // Check if any job actually changed
        for (const updatedJob of updates) {
          const existingJob = ocrJobsRef.current.get(updatedJob.student?._id);
          if (!existingJob || 
              existingJob.status !== updatedJob.status || 
              existingJob.progress !== updatedJob.progress) {
            hasChanges = true;
            break;
          }
        }
        
        if (hasChanges) {
          setOcrJobs(prev => {
            const updated = new Map(prev);
            const now = Date.now();
            let activeCount = 0;
            
            updates.forEach(updatedJob => {
              if (updatedJob.studentId || updatedJob.student?._id) {
                const studentId = updatedJob.studentId || updatedJob.student?._id;
                const existingJob = updated.get(studentId);
                
                // Don't store large base64 imageUrl to save memory
                // Preserve student info from existing job if available
                const optimizedJob = {
                  ...updatedJob,
                  student: existingJob?.student || updatedJob.student || { _id: studentId },
                  imageUrl: null // Clear image data after processing
                };
                updated.set(studentId, optimizedJob);
              }
            });
            
            // Auto-clean completed/failed jobs older than 30 seconds and count active jobs
            for (const [studentId, job] of updated.entries()) {
              if (job.status === 'pending' || job.status === 'processing') {
                activeCount++;
              } else if ((job.status === 'completed' || job.status === 'failed') && job.completedAt) {
                const completedTime = new Date(job.completedAt).getTime();
                if (now - completedTime > 30000) { // 30 seconds
                  updated.delete(studentId);
                }
              }
            }
            
            // Limit total jobs to 10 most recent to prevent memory bloat
            if (updated.size > 10) {
              const sortedJobs = Array.from(updated.entries())
                .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt))
                .slice(0, 10);
              updated.clear();
              sortedJobs.forEach(([id, job]) => updated.set(id, job));
            }
            
            setActiveJobCount(activeCount);
            return updated;
          });
          
          // Auto-fill marks if current student's job completed
          if (currentStudentUpdate) {
            console.log('Current student job completed:', currentStudentUpdate);
            if (currentStudentUpdate.marks) {
              console.log('Auto-filling marks:', currentStudentUpdate.marks);
              setMarks(currentStudentUpdate.marks);
            } else {
              console.warn('Job completed but no marks found in response');
            }
          }
        }
      }
    };
    
    // Start polling
    pollJobs(); // Initial poll
    pollIntervalRef.current = setInterval(pollJobs, 4000); // Poll every 4 seconds
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeJobCount]); // Re-run when activeJobCount changes

  // Poll queue status
  useEffect(() => {
    const pollQueueStatus = async () => {
      try {
        const response = await getQueueStatus();
        if (response.success) {
          setQueueStatus(response.data);
        }
      } catch (error) {
        console.error('Error fetching queue status:', error);
      }
    };

    // Poll queue status every 5 seconds
    pollQueueStatus(); // Initial poll
    queuePollIntervalRef.current = setInterval(pollQueueStatus, 5000);

    return () => {
      if (queuePollIntervalRef.current) {
        clearInterval(queuePollIntervalRef.current);
        queuePollIntervalRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Load saved data when student changes
  useEffect(() => {
    const loadStudentMarks = async () => {
      setIsLoadingData(true);
      const studentId = currentStudent._id;
      
      let marksLoaded = false;
      let imageLoaded = false;
      
      // Priority 1: Check if there's a completed OCR job (from memory only, no lazy loading)
      const ocrJob = ocrJobsRef.current.get(studentId);
      
      if (ocrJob && ocrJob.status === 'completed' && ocrJob.marks) {
        setMarks(ocrJob.marks);
        marksLoaded = true;
        imageLoaded = true; // Don't load image since we cleared it
      }
      
      // Priority 2: Check in-memory cache (if not loaded from OCR job)
      if (!marksLoaded && studentData[studentId]) {
        setMarks(studentData[studentId].marks);
        setCapturedImage(studentData[studentId].image);
        marksLoaded = true;
        imageLoaded = true;
      }
      
      // Priority 3: Fetch from database (if not loaded from OCR job or cache)
      try {
        const response = await getTermExamMarks(studentId, course._id, section);
        if (response.success && response.data) {
          setSavedMarks(response.data.marks); // Track database version
          
          // Only load from database if no session/cache data
          if (!marksLoaded) {
            setMarks(response.data.marks);
          }
          
          const validImage = response.data.imageUrl && !response.data.imageUrl.startsWith('blob:') ? response.data.imageUrl : null;
          
          // Only load image from database if no OCR job or cache image
          // Also don't overwrite a freshly captured image (blob URL)
          if (!imageLoaded) {
            setCapturedImage(prev => prev?.startsWith('blob:') ? prev : validImage);
          }
          
          // Update in-memory cache only if we don't have fresher OCR job data
          if (!ocrJob || ocrJob.status !== 'completed') {
            setStudentData(prev => ({
              ...prev,
              [studentId]: {
                marks: response.data.marks,
                image: validImage
              }
            }));
          }
        } else {
          // No marks found in database
          setSavedMarks(null);
        }
      } catch (error) {
        // No marks found in database - reset to empty only if no OCR job or cache data
        setSavedMarks(null);
        if (!marksLoaded) {
          setMarks({
            a: { '1': '', '2': '', '3': '', '4': '' },
            b: { '1': '', '2': '', '3': '', '4': '' },
            c: { '1': '', '2': '', '3': '', '4': '' },
            d: { '1': '', '2': '', '3': '', '4': '' },
            e: { '1': '', '2': '', '3': '', '4': '' },
            f: { '1': '', '2': '', '3': '', '4': '' },
            g: { '1': '', '2': '', '3': '', '4': '' }
          });
          // Don't clear image if it's a fresh capture (blob URL) - only clear if no image or non-blob
          if (!imageLoaded) {
            setCapturedImage(prev => prev?.startsWith('blob:') ? prev : null);
          }
        }
      }
      
      setIsLoadingData(false);
    };
    
    loadStudentMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentIndex, currentStudent._id, course._id, section]);
  
  // Check for unsaved changes (memoized to reduce re-computations)
  const hasChangesComputed = useMemo(() => {
    if (!savedMarks) {
      // No saved marks in database, check if current marks are empty
      const isEmpty = Object.values(marks).every(q => 
        Object.values(q).every(v => !v || v === '')
      );
      return !isEmpty;
    }
    
    // Compare current marks with saved marks
    return JSON.stringify(marks) !== JSON.stringify(savedMarks);
  }, [marks, savedMarks]);
  
  useEffect(() => {
    setHasUnsavedChanges(hasChangesComputed);
  }, [hasChangesComputed]);

  // Cleanup camera stream on unmount or when camera closes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);
  
  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    const currentImage = capturedImage;
    return () => {
      if (currentImage && currentImage.startsWith('blob:')) {
        URL.revokeObjectURL(currentImage);
      }
    };
  }, [capturedImage]);

  // Setup video stream when stream is available
  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current; // Store ref value
      video.srcObject = stream;
      
      const handleCanPlay = () => {
        console.log('Video can play');
        setVideoReady(true);
      };

      const handleLoadedMetadata = () => {
        console.log('Video metadata loaded');
        // Give it a moment to ensure video is actually ready
        setTimeout(() => {
          setVideoReady(true);
        }, 500);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [stream, showCamera]);

  // Initialize camera
  const startCamera = async () => {
    // On mobile, trigger the native camera input instead of embedded camera
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
      return;
    }
    
    // Desktop: Use embedded camera
    try {
      setVideoReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setShowCamera(true);
      setStream(mediaStream);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setVideoReady(false);
  };

  // Compress image while maintaining quality
  const compressImage = async (imageUrl, maxWidth = 1920, maxHeight = 1920, quality = 0.9) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        // Use better image smoothing for quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with high quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      // Check if video is ready and has valid dimensions
      if (!video.videoWidth || !video.videoHeight) {
        console.error('Video not ready or has invalid dimensions');
        alert('Video is not ready yet. Please wait a moment and try again.');
        return;
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          // Compress the image before setting
          try {
            const compressedUrl = await compressImage(imageUrl, 1920, 1920, 0.92);
            URL.revokeObjectURL(imageUrl); // Clean up original
            setCapturedImage(compressedUrl);
            stopCamera();
          } catch (error) {
            console.error('Compression error:', error);
            // Fallback to original if compression fails
            setCapturedImage(imageUrl);
            stopCamera();
          }
        } else {
          console.error('Failed to create blob from canvas');
          alert('Failed to capture image. Please try again.');
        }
      }, 'image/jpeg', 0.92);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      // Compress the uploaded image
      try {
        const compressedUrl = await compressImage(imageUrl, 1920, 1920, 0.92);
        URL.revokeObjectURL(imageUrl); // Clean up original
        setCapturedImage(compressedUrl);
      } catch (error) {
        console.error('Compression error:', error);
        // Fallback to original if compression fails
        setCapturedImage(imageUrl);
      }
    } else {
      alert('Please select a valid image file');
    }
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setMarks({
      a: { '1': '', '2': '', '3': '', '4': '' },
      b: { '1': '', '2': '', '3': '', '4': '' },
      c: { '1': '', '2': '', '3': '', '4': '' },
      d: { '1': '', '2': '', '3': '', '4': '' },
      e: { '1': '', '2': '', '3': '', '4': '' },
      f: { '1': '', '2': '', '3': '', '4': '' },
      g: { '1': '', '2': '', '3': '', '4': '' }
    });
    
    // Clear the student's data from in-memory cache and OCR jobs
    const studentId = currentStudent._id;
    setStudentData(prev => {
      const updated = { ...prev };
      delete updated[studentId];
      return updated;
    });
    
    // Remove OCR job for this student to prevent auto-reload
    setOcrJobs(prev => {
      const updated = new Map(prev);
      updated.delete(studentId);
      return updated;
    });
  };

  // Process image with FastAPI (non-blocking, queue-based)
  const processImage = async () => {
    if (!capturedImage || capturedImage === 'skipped') return;

    const studentId = currentStudent._id;
    setIsProcessingImage(true);
    
    try {
      // Convert blob URL to base64 if needed
      let imageDataUrl = capturedImage;
      if (capturedImage.startsWith('blob:')) {
        const blob = await fetch(capturedImage).then(r => r.blob());
        imageDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
      
      // Submit OCR job
      const response = await submitOCRJob(studentId, course._id, section, imageDataUrl);
      
      if (response.success) {
        // Update OCR jobs map with new job (don't store base64 image to save memory)
        const newJob = {
          jobId: response.jobId,
          studentId: studentId, // Use studentId to match server response structure
          student: { _id: studentId, name: currentStudent.name, roll: currentStudent.roll },
          courseId: course._id,
          course: { _id: course._id },
          imageUrl: null, // Don't store large base64 in state
          status: 'pending',
          progress: 0,
          createdAt: new Date()
        };
        
        console.log('Job created and stored with studentId:', studentId);
        
        setOcrJobs(prev => {
          const updated = new Map(prev);
          updated.set(studentId, newJob);
          return updated;
        });
        
        // Increment active job count to trigger polling
        setActiveJobCount(prev => prev + 1);
        
        // Clear captured image and move to next student immediately
        setCapturedImage(null);
        
        // Revoke blob URL to free memory if it exists
        if (capturedImage && capturedImage.startsWith('blob:')) {
          URL.revokeObjectURL(capturedImage);
        }
        
        if (currentStudentIndex < students.length - 1) {
          setCurrentStudentIndex(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error submitting OCR job:', error);
      alert('Failed to submit OCR job. Please try again.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  // Handle mark change
  const handleMarkChange = useCallback((row, question, value) => {
    // Only allow numbers
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    setMarks(prev => ({
      ...prev,
      [row]: {
        ...prev[row],
        [question]: value
      }
    }));
    // Note: studentData cache update moved to handleNext/handleSave to reduce re-renders
  }, []);

  // Calculate total marks (memoized to prevent recalculation on every render)
  const totalMarks = useMemo(() => {
    let total = 0;
    Object.values(marks).forEach(question => {
      Object.values(question).forEach(mark => {
        total += parseFloat(mark) || 0;
      });
    });
    return total.toFixed(2);
  }, [marks]);
  
  // Manual save to database
  const handleSave = useCallback(async () => {
    const studentId = currentStudent._id;
    
    try {
      await saveTermExamMarks({
        studentId: studentId,
        courseId: course._id,
        section: section,
        marks: marks,
        totalMarks: parseFloat(totalMarks),
        imageUrl: capturedImage && !capturedImage.startsWith('blob:') && capturedImage !== 'skipped' ? capturedImage : null
      });
      
      // Update saved marks to current marks
      setSavedMarks(marks);
      
      // Update in-memory cache (without blob URLs)
      setStudentData(prev => ({
        ...prev,
        [studentId]: {
          marks: marks,
          image: capturedImage && !capturedImage.startsWith('blob:') ? capturedImage : null
        }
      }));
      
      alert('Marks saved successfully!');
    } catch (error) {
      console.error('Error saving marks:', error);
      alert('Failed to save marks: ' + error.message);
    }
  }, [currentStudent._id, course._id, section, marks, totalMarks, capturedImage]);

  // Save and go to next student
  const handleNext = useCallback(async () => {
    const studentId = currentStudent._id;
    
    if (hasUnsavedChanges) {
      // Save current student's data to database
      try {
        await saveTermExamMarks({
          studentId: studentId,
          courseId: course._id,
          section: section,
          marks: marks,
          totalMarks: parseFloat(totalMarks),
          // Don't save blob URLs to database as they expire
          imageUrl: capturedImage && !capturedImage.startsWith('blob:') && capturedImage !== 'skipped' ? capturedImage : null
        });
        
        
        // Update in-memory cache (without blob URLs)
        setStudentData(prev => ({
          ...prev,
          [studentId]: {
            marks: marks,
            image: capturedImage && !capturedImage.startsWith('blob:') ? capturedImage : null
          }
        }));
        
      } catch (error) {
        console.error('Error saving marks:', error);
        // Continue anyway - marks saved in memory
      }
    }
    
    // Clean up blob URL before moving to next student
    if (capturedImage && capturedImage.startsWith('blob:')) {
      URL.revokeObjectURL(capturedImage);
    }
    
    if (currentStudentIndex < students.length - 1) {
      // Move to next student - data will be loaded by useEffect
      setCurrentStudentIndex(prev => prev + 1);
    } else {
      // All students completed
      onClose();
    }
  }, [hasUnsavedChanges, currentStudent._id, course._id, section, marks, totalMarks, capturedImage, currentStudentIndex, students.length, onClose]);

  // Go to previous student
  const handlePrevious = () => {
    if (currentStudentIndex > 0) {
      // Clean up blob URL before moving to prevent memory leak
      if (capturedImage && capturedImage.startsWith('blob:')) {
        URL.revokeObjectURL(capturedImage);
      }
      
      // Save current student's data before moving
      const studentId = currentStudent._id;
      setStudentData(prev => ({
        ...prev,
        [studentId]: {
          marks: marks,
          image: capturedImage && !capturedImage.startsWith('blob:') ? capturedImage : null
        }
      }));
      
      // Move to previous student - data will be loaded by useEffect
      setCurrentStudentIndex(prev => prev - 1);
    }
  };

  // Jump to specific student by roll number
  const handleJumpToStudent = (rollNumber) => {
    const trimmedRoll = rollNumber.trim();
    if (!trimmedRoll) return;

    // Save current student's data before jumping
    const currentStudentId = currentStudent._id;
    setStudentData(prev => ({
      ...prev,
      [currentStudentId]: {
        marks: marks,
        image: capturedImage
      }
    }));

    // Find and jump to selected student
    const targetIndex = students.findIndex(s => s.roll === trimmedRoll);
    if (targetIndex !== -1) {
      setCurrentStudentIndex(targetIndex);
    } else {
      alert(`Student with roll number "${trimmedRoll}" not found in this course.`);
    }
  };

  // Handle Enter key press in roll input
  const handleRollInputKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent default form submission behavior
      const rollValue = event.target.value;
      handleJumpToStudent(rollValue);
      event.target.value = ''; // Clear input after jumping
      event.target.blur(); // Remove focus from input
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content mark-entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{course.courseCode} - Term Exam Marks Entry</h3>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
              {section ? `Section ${section}` : ''} • Student {currentStudentIndex + 1} of {students.length}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="modal-body mark-entry-body">
          {/* Loading State */}
          {isLoadingData && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 10
            }}>
              <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: '#2563eb', marginBottom: '8px' }} />
              <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading student data...</p>
            </div>
          )}
          
          {/* Main Content */}
          <div style={{ opacity: isLoadingData ? 0.3 : 1, pointerEvents: isLoadingData ? 'none' : 'auto' }}>
          {/* Student Info */}
          <div className="student-info-card">
            <div>
              <h4>{currentStudent.name}</h4>
              <p>Roll: {currentStudent.roll}</p>
            </div>
            <div className="student-navigation">
              <div className="student-progress">
                {currentStudentIndex + 1} / {students.length}
              </div>
              <input
                type="text"
                className="student-selector"
                placeholder="Enter roll & press Enter"
                onKeyPress={handleRollInputKeyPress}
              />
            </div>
          </div>
          
          {/* OCR Jobs Status - Memoized to prevent re-renders */}
          {ocrJobs.size > 0 && (() => {
            const activeJobsCount = Array.from(ocrJobs.values()).filter(j => j.status === 'pending' || j.status === 'processing').length;
            const jobsToDisplay = Array.from(ocrJobs.entries()).slice(-3).reverse(); // Get last 3 jobs
            
            return (
              <div style={{
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                  OCR Jobs ({activeJobsCount} active)
                </h5>
                {jobsToDisplay.map(([id, job]) => (
                <div key={id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <span style={{ fontSize: '13px' }}>
                    Roll: {job.student?.roll || 'N/A'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {job.status === 'pending' && <span style={{ fontSize: '12px', color: '#f59e0b' }}><FontAwesomeIcon icon={faClock} /> Queued</span>}
                    {job.status === 'processing' && (
                      <>
                        <div style={{ width: '80px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${job.progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}><FontAwesomeIcon icon={faHourglassHalf} /> {job.progress}%</span>
                      </>
                    )}
                    {job.status === 'completed' && <span style={{ fontSize: '12px', color: '#10b981' }}><FontAwesomeIcon icon={faCheck} /> Done</span>}
                    {job.status === 'failed' && <span style={{ fontSize: '12px', color: '#ef4444' }}><FontAwesomeIcon icon={faCircleXmark} /> Failed</span>}
                  </div>
                </div>
              ))}
              {ocrJobs.size > 3 && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  +{ocrJobs.size - 3} more jobs...
                </div>
              )}
            </div>
            );
          })()}
          
          {/* Queue Status */}
          {queueStatus && queueStatus.counts.waiting > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #f59e0b',
              borderRadius: '12px',
              padding: '8px 16px',
              marginBottom: '16px',
              boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)'
            }}>
              <span style={{ fontSize: '18px' }}><FontAwesomeIcon icon={faSpinner}/></span>
              <div>
                <span style={{ fontWeight: '700', fontSize: '20px', color: '#92400e' }}>
                  {queueStatus.counts.waiting}
                </span>
                <span style={{ fontSize: '13px', color: '#78350f', marginLeft: '6px', fontWeight: '500' }}>
                  in queue
                </span>
              </div>
            </div>
          )}
          
          {/* Current student OCR job status */}
          {ocrJobs.has(currentStudent._id) && ocrJobs.get(currentStudent._id).status !== 'completed' && (
            <div style={{
              background: ocrJobs.get(currentStudent._id).status === 'failed' ? '#fee2e2' : '#dbeafe',
              border: '1px solid',
              borderColor: ocrJobs.get(currentStudent._id).status === 'failed' ? '#ef4444' : '#3b82f6',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {ocrJobs.get(currentStudent._id).status === 'pending' && (
                <><FontAwesomeIcon icon={faClock} /> OCR job queued for this student...</>
              )}
              {ocrJobs.get(currentStudent._id).status === 'processing' && (
                <><FontAwesomeIcon icon={faHourglassHalf} /> Processing image for this student... ({ocrJobs.get(currentStudent._id).progress}%)</>
              )}
              {ocrJobs.get(currentStudent._id).status === 'failed' && (
                <><FontAwesomeIcon icon={faCircleXmark} /> OCR processing failed: {ocrJobs.get(currentStudent._id).error}</>
              )}
            </div>
          )}
          
          {/* Completed OCR job notification */}
          {ocrJobs.has(currentStudent._id) && ocrJobs.get(currentStudent._id).status === 'completed' && (
            <div style={{
              background: '#d1fae5',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
               <FontAwesomeIcon icon={faCheck} /> OCR processing completed! Marks have been auto-filled.
            </div>
          )}

          {/* Image Capture/Upload Section */}
          {!capturedImage && !showCamera && !ocrJobs.has(currentStudent._id) && (
            <div className="image-upload-section">
              <h4>Upload Answer Sheet</h4>
              <div className="upload-options">
                <button className="btn btn-primary" onClick={startCamera}>
                  <FontAwesomeIcon icon={faCamera} /> Take Picture
                </button>
                <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
                  <FontAwesomeIcon icon={faUpload} /> Upload File
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileUpload}
              />
              <input
                type="file"
                ref={cameraInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
              />
            </div>
          )}
          
          {/* Show message when OCR is active but no image to display */}
          {!capturedImage && !showCamera && ocrJobs.has(currentStudent._id) && ['pending', 'processing'].includes(ocrJobs.get(currentStudent._id).status) && (
            <div className="image-upload-section">
              <div style={{
                background: '#f3f4f6',
                border: '2px dashed #9ca3af',
                borderRadius: '8px',
                padding: '32px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: '32px', marginBottom: '12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Image submitted for processing...</p>
              </div>
            </div>
          )}

          {/* Camera View */}
          {showCamera && (
            <div className="camera-section">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                style={{ width: '100%', maxWidth: '600px', borderRadius: '8px' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {!videoReady && (
                <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>
                  Initializing camera...
                </div>
              )}
              <div className="camera-controls">
                <button className="btn btn-outline" onClick={stopCamera}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={capturePhoto}
                  disabled={!videoReady}>
                  <FontAwesomeIcon icon={faCamera} /> Capture
                </button>
              </div>
            </div>
          )}

          {/* Captured Image Preview - Only show if NOT yet submitted for processing */}
          {capturedImage && capturedImage !== 'skipped' && !ocrJobs.has(currentStudent._id) && (
            <div className="image-preview-section">
              <h4>Answer Sheet</h4>
              <div className="image-container">
                <img src={capturedImage} alt="Answer sheet" className="captured-image" />
              </div>
              <div className="image-actions">
                <button className="btn btn-outline" onClick={handleRetake}>
                  <FontAwesomeIcon icon={faCamera} /> Retake
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={processImage}
                  disabled={isProcessingImage}
                >
                  {isProcessingImage ? (
                    <><FontAwesomeIcon icon={faSpinner} spin /> Submitting...</>
                  ) : (
                    <>Process Image</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Marks Entry Form */}
          {(capturedImage || showCamera === false) && (
            <div className="marks-form-section">
              <h4>Enter Marks</h4>
              <div className="marks-table-container">
                <table className="marks-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Q1</th>
                      <th>Q2</th>
                      <th>Q3</th>
                      <th>Q4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(row => (
                      <tr key={row}>
                        <td className="row-label">{row}</td>
                        {['1', '2', '3', '4'].map(question => (
                          <td key={question}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={marks[row][question]}
                              onChange={(e) => handleMarkChange(row, question, e.target.value)}
                              placeholder="0"
                              className="mark-input"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Total Marks */}
              <div className="total-marks">
                <strong>Total Marks:</strong>
                <span className="total-value">{totalMarks}</span>
              </div>
            </div>
          )}
          </div> {/* End of main content wrapper */}
        </div>

        {/* Footer with Navigation */}
        <div className="modal-footer mark-entry-footer">
          <div>
            <button 
              className="btn btn-outline" 
              onClick={handlePrevious}
              disabled={currentStudentIndex === 0}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> Previous
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {hasUnsavedChanges && (
              <button 
                className="btn btn-success" 
                onClick={handleSave}
                style={{ background: '#10b981', borderColor: '#10b981' }}
              >
                <FontAwesomeIcon icon={faCheck} /> Save
              </button>
            )}
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
          <div>
            <button 
              className="btn btn-primary" 
              onClick={handleNext}
            >
              {currentStudentIndex === students.length - 1 ? (
                <>
                  <FontAwesomeIcon icon={faCheck} /> Finish
                </>
              ) : (
                <>
                  Next <FontAwesomeIcon icon={faChevronRight} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkEntry;
