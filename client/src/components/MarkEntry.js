import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCamera, faUpload, faChevronLeft, faChevronRight, faCheck, faSpinner, faClock, faHourglassHalf, faCircleXmark } from '@fortawesome/free-solid-svg-icons';
import { getTermExamMarks, saveTermExamMarks } from '../services/termExamMarksService';
import { submitOCRJob, getOCRJobStatus, getQueueStatus } from '../services/ocrJobService';
import { getSectionAData, saveSectionAData } from '../services/attainmentService';
import { getCourseProfile } from '../services/courseProfileService';
import '../styles/MarkEntry.css';

const MarkEntry = ({ course, students, section, onClose }) => {
  // Normalize section to uppercase and trim whitespace, default to 'A' if null/undefined
  const normalizedSection = section ? section.toString().trim().toUpperCase() : 'A';
  
  // Warn if section is null - this means teacher assignment may not have section set
  if (!section) {
    console.warn(`⚠️ Section is null for course ${course?.courseCode}. Defaulting to Section A. Please ensure teachers are assigned to specific sections in the course settings.`);
  }
  
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [marks, setMarks] = useState({
    a: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    b: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    c: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    d: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    e: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    f: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
    g: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' }
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

  // Marks Distribution state
  const [showMarksDistribution, setShowMarksDistribution] = useState(false);
  const [distSectionARows, setDistSectionARows] = useState([]);
  const [distSectionBRows, setDistSectionBRows] = useState([]);
  const [distSaveStatus, setDistSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [distLoading, setDistLoading] = useState(false);
  
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
        job => job.status === 'pending' || job.status === 'processing' || job.status === 'retrying'
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
            updates.push(response.data);
          }
        } catch (error) {
          console.error(`Error polling job ${job.jobId}:`, error);
        }
      }
      
      // Only update state if there are actual changes
      if (updates.length > 0) {
        
        let hasChanges = false;
        
        // Check if any job actually changed
        for (const updatedJob of updates) {
          const existingJob = ocrJobsRef.current.get(updatedJob.studentId);
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
              if (updatedJob.studentId) {
                const studentId = updatedJob.studentId;
                
                // Don't store large base64 imageUrl to save memory
                const optimizedJob = {
                  ...updatedJob,
                  imageUrl: null // Clear image data after processing
                };
                updated.set(studentId, optimizedJob);
                
                // Immediately cache completed jobs to studentData
                if (updatedJob.status === 'completed' && updatedJob.marks) {
                  setStudentData(prevData => ({
                    ...prevData,
                    [studentId]: {
                      marks: updatedJob.marks,
                      image: prevData[studentId]?.image || null
                    }
                  }));
                  
                  // Update marks if this is the current student
                  if (studentId === currentStudentIdRef.current) {
                    setMarks(updatedJob.marks);
                  }
                }
              }
            });
            
            // Count active jobs only (don't auto-clean completed jobs)
            // Completed jobs stay in memory until page refresh
            for (const [studentId, job] of updated.entries()) {
              if (job.status === 'pending' || job.status === 'processing' || job.status === 'retrying') {
                activeCount++;
              }
            }
            
            // Limit total jobs to 130 most recent to prevent memory bloat
            // This allows for larger classes without losing data
            if (updated.size > 130) {
              const sortedJobs = Array.from(updated.entries())
                .sort((a, b) => new Date(b[1].createdAt) - new Date(a[1].createdAt))
                .slice(0, 130);
              updated.clear();
              sortedJobs.forEach(([id, job]) => updated.set(id, job));
            }
            
            setActiveJobCount(activeCount);
            return updated;
          });
        }
      }
    };
    
    // Start polling
    pollJobs(); // Initial poll
    pollIntervalRef.current = setInterval(pollJobs, 2000); // Poll every 2 seconds for faster updates
    
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
        const response = await getTermExamMarks(studentId, course._id, normalizedSection);
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
            a: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            b: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            c: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            d: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            e: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            f: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
            g: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' }
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
  }, [currentStudentIndex, currentStudent._id, course._id, normalizedSection]);
  
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
        setVideoReady(true);
      };

      const handleLoadedMetadata = () => {
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
      a: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      b: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      c: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      d: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      e: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      f: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' },
      g: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '', '7': '', '8': '' }
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
      const response = await submitOCRJob(
        studentId, 
        course._id, 
        normalizedSection, 
        imageDataUrl,
        { _id: studentId, name: currentStudent.name, roll: currentStudent.roll } // Send student info
      );
      
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

    // Cap the value at the distribution mark for this sub-question
    if (value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Map question number to distribution field prefix (SecB uses Q1-Q4 internally)
        const distRows = normalizedSection === 'A' ? distSectionARows : distSectionBRows;
        const qNum = normalizedSection === 'A' ? question : String(parseInt(question) - 4);
        const distField = `Q${qNum}${row}`;
        const maxAllowed = distRows.reduce((sum, r) => sum + (parseFloat(r[distField]) || 0), 0);
        if (maxAllowed > 0 && num > maxAllowed) return; // Reject values exceeding distribution
      }
    }
    
    setMarks(prev => ({
      ...prev,
      [row]: {
        ...prev[row],
        [question]: value
      }
    }));
    // Note: studentData cache update moved to handleNext/handleSave to reduce re-renders
  }, [normalizedSection, distSectionARows, distSectionBRows]);

  // Handle keyboard navigation between mark input cells
  const handleMarkKeyDown = useCallback((e, row, question) => {
    const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const COLS_A = ['1', '2', '3', '4'];
    const COLS_B = ['5', '6', '7', '8'];
    const cols = normalizedSection === 'A' ? COLS_A : COLS_B;

    let targetRow = row;
    let targetCol = question;

    if (e.key === 'ArrowDown') {
      const nextRowIdx = ROWS.indexOf(row) + 1;
      if (nextRowIdx >= ROWS.length) return;
      targetRow = ROWS[nextRowIdx];
    } else if (e.key === 'ArrowUp') {
      const prevRowIdx = ROWS.indexOf(row) - 1;
      if (prevRowIdx < 0) return;
      targetRow = ROWS[prevRowIdx];
    } else if (e.key === 'ArrowRight') {
      const nextColIdx = cols.indexOf(question) + 1;
      if (nextColIdx >= cols.length) return;
      targetCol = cols[nextColIdx];
    } else if (e.key === 'ArrowLeft') {
      const prevColIdx = cols.indexOf(question) - 1;
      if (prevColIdx < 0) return;
      targetCol = cols[prevColIdx];
    } else {
      return;
    }

    e.preventDefault();
    const target = document.querySelector(
      `.marks-table [data-row="${targetRow}"][data-col="${targetCol}"]`
    );
    if (target) target.focus();
  }, [normalizedSection]);

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
        section: normalizedSection,
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
      
    } catch (error) {
      console.error('Error saving marks:', error);
      alert('Failed to save marks: ' + error.message);
    }
  }, [currentStudent._id, currentStudent.name, currentStudent.roll, course._id, course.courseCode, normalizedSection, marks, totalMarks, capturedImage]);

  // Save and go to next student
  const handleNext = useCallback(async () => {
    const studentId = currentStudent._id;
    
    if (hasUnsavedChanges) {
      // Save current student's data to database
      try {
        await saveTermExamMarks({
          studentId: studentId,
          courseId: course._id,
          section: normalizedSection,
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
        alert(`⚠️ Failed to auto-save marks for ${currentStudent.name}: ${error.message}`);
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
  }, [hasUnsavedChanges, currentStudent._id, course._id, normalizedSection, marks, totalMarks, capturedImage, currentStudentIndex, students.length, onClose]);

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

  // ── Marks Distribution helpers ──────────────────────────────────────────────
  // Load saved section A/B allocation rows on mount
  useEffect(() => {
    const loadDist = async () => {
      setDistLoading(true);
      try {
        const [sectionResp, profileResp] = await Promise.all([
          getSectionAData(course._id),
          getCourseProfile(course.courseCode)
        ]);
        const clos = (profileResp?.success && profileResp.data) ? profileResp.data : [];
        const initRow = (coNumber) => ({
          coNumber,
          Q1a: 0, Q1b: 0, Q1c: 0, Q1d: 0,
          Q2a: 0, Q2b: 0, Q2c: 0, Q2d: 0,
          Q3a: 0, Q3b: 0, Q3c: 0, Q3d: 0,
          Q4a: 0, Q4b: 0, Q4c: 0, Q4d: 0,
        });
        let aRows = [], bRows = [];
        if (sectionResp?.success && sectionResp.data) {
          const saved = sectionResp.data;
          const aMap = {}, bMap = {};
          (saved.sectionARows || []).forEach(r => { aMap[r.coNumber] = r; });
          (saved.sectionBRows || []).forEach(r => { bMap[r.coNumber] = r; });
          aRows = clos.length > 0
            ? clos.map(clo => { const co = (clo.cloNumber || '').toString().replace('CLO', 'CO'); return aMap[co] || initRow(co); })
            : (saved.sectionARows || []);
          bRows = clos.length > 0
            ? clos.map(clo => { const co = (clo.cloNumber || '').toString().replace('CLO', 'CO'); return bMap[co] || initRow(co); })
            : (saved.sectionBRows || []);
        } else {
          aRows = clos.map(clo => initRow((clo.cloNumber || '').toString().replace('CLO', 'CO')));
          bRows = clos.map(clo => initRow((clo.cloNumber || '').toString().replace('CLO', 'CO')));
        }
        setDistSectionARows(aRows);
        setDistSectionBRows(bRows);
      } catch (err) {
        console.error('Failed to load marks distribution:', err);
      } finally {
        setDistLoading(false);
      }
    };
    loadDist();
  }, [course._id, course.courseCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const computeDistQuestionTotals = (rows) => {
    const letters = ['a', 'b', 'c', 'd'];
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(q =>
      letters.reduce((s, l) => s + rows.reduce((rs, row) => rs + (parseFloat(row[`${q}${l}`]) || 0), 0), 0)
    );
  };

  const handleDistCellChange = (section, idx, field, value) => {
    const num = parseFloat(value) || 0;
    if (section === 'A') {
      setDistSectionARows(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: num }; return u; });
    } else {
      setDistSectionBRows(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: num }; return u; });
    }
  };

  const handleSaveDistribution = async () => {
    setDistSaveStatus('saving');
    try {
      await saveSectionAData(course._id, {
        sectionARows: distSectionARows,
        sectionBRows: distSectionBRows,
        sectionAObtainedRows: [],
        sectionBObtainedRows: [],
      });
      setDistSaveStatus('saved');
      setTimeout(() => setDistSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save marks distribution:', err);
      setDistSaveStatus('error');
      setTimeout(() => setDistSaveStatus('idle'), 3000);
    }
  };

  const distATotals = computeDistQuestionTotals(distSectionARows);
  const distBTotals = computeDistQuestionTotals(distSectionBRows);
  const isDistributionValid = (normalizedSection === 'A' ? distATotals : distBTotals).every(t => t === 35);
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay">
      <div className="modal-content mark-entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {showMarksDistribution ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setShowMarksDistribution(false)}
                    style={{ padding: '6px 12px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                  >
                    ← Back
                  </button>
                  <div>
                    <h3>{course.courseCode} - Marks Distribution</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
                      Section {normalizedSection} — set each question total to <strong>35</strong> before entering marks
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {distSaveStatus === 'saved' && <span style={{ color: '#27ae60', fontWeight: 'bold' }}>✓ Saved</span>}
                  {distSaveStatus === 'error' && <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>✗ Error saving</span>}
                  <button
                    onClick={handleSaveDistribution}
                    disabled={distSaveStatus === 'saving'}
                    style={{ padding: '8px 16px', backgroundColor: distSaveStatus === 'saving' ? '#95a5a6' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: distSaveStatus === 'saving' ? 'not-allowed' : 'pointer', fontWeight: '600' }}
                  >
                    {distSaveStatus === 'saving' ? 'Saving...' : 'Save Distribution'}
                  </button>
                  <button className="close-btn" onClick={onClose}>
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div>
                  <h3>{course.courseCode} - Term Exam Marks Entry</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
                    {normalizedSection ? `Section ${normalizedSection}` : ''} • Student {currentStudentIndex + 1} of {students.length}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setShowMarksDistribution(true)}
                  style={{ padding: '6px 12px', backgroundColor: isDistributionValid ? '#27ae60' : '#e67e22', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {isDistributionValid ? '✓ Set Marks Distribution' : '⚠ Set Marks Distribution'}
                </button>
                <button className="close-btn" onClick={onClose}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </>
          )}
        </div>

        {!showMarksDistribution && (
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
          
          {/* Warning if section is null */}
          {!section && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#92400e'
            }}>
              ℹ️ <strong>Note:</strong> No section assigned for this course. Defaulting to Section A (Questions 1-4). Please contact admin to assign sections properly.
            </div>
          )}
          
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
            const activeJobsCount = Array.from(ocrJobs.values()).filter(j => j.status === 'pending' || j.status === 'processing' || j.status === 'retrying').length;
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
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}>
                          <FontAwesomeIcon icon={faHourglassHalf} /> {job.progress}%
                          {job.isRetry && ` (Retry ${job.attemptNumber}/${job.maxAttempts})`}
                        </span>
                      </>
                    )}
                    {job.status === 'retrying' && (
                      <span style={{ fontSize: '12px', color: '#f59e0b' }}>
                        <FontAwesomeIcon icon={faHourglassHalf} /> Retrying ({job.attemptNumber}/{job.maxAttempts})...
                      </span>
                    )}
                    {job.status === 'completed' && (
                      <span style={{ fontSize: '12px', color: '#10b981' }}>
                        <FontAwesomeIcon icon={faCheck} /> Done{job.succeededAfterRetry ? ' (after retry)' : ''}
                      </span>
                    )}
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
          {queueStatus && (() => {
            const isBusy = queueStatus.status === 'busy';
            
            return (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: isBusy 
                  ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' 
                  : 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                border: isBusy ? '2px solid #f59e0b' : '2px solid #10b981',
                borderRadius: '12px',
                padding: '8px 16px',
                marginBottom: '16px',
                boxShadow: isBusy 
                  ? '0 2px 4px rgba(245, 158, 11, 0.1)' 
                  : '0 2px 4px rgba(16, 185, 129, 0.1)'
              }}>
                <span style={{ fontSize: '18px' }}>
                  <FontAwesomeIcon icon={isBusy ? faSpinner : faCheck} spin={isBusy} />
                </span>
                <div>
                  <span style={{ 
                    fontWeight: '600', 
                    fontSize: '15px', 
                    color: isBusy ? '#92400e' : '#065f46' 
                  }}>
                    OCR server {isBusy ? 'busy' : 'free'}
                  </span>
                </div>
              </div>
            );
          })()}
          
          {/* Current student OCR job status */}
          {ocrJobs.has(currentStudent._id) && ocrJobs.get(currentStudent._id).status !== 'completed' && (
            <div style={{
              background: ocrJobs.get(currentStudent._id).status === 'failed' ? '#fee2e2' : 
                         ocrJobs.get(currentStudent._id).status === 'retrying' ? '#fef3c7' : '#dbeafe',
              border: '1px solid',
              borderColor: ocrJobs.get(currentStudent._id).status === 'failed' ? '#ef4444' : 
                          ocrJobs.get(currentStudent._id).status === 'retrying' ? '#f59e0b' : '#3b82f6',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {ocrJobs.get(currentStudent._id).status === 'pending' && (
                <><FontAwesomeIcon icon={faClock} /> OCR job queued for this student...</>
              )}
              {ocrJobs.get(currentStudent._id).status === 'processing' && (
                <><FontAwesomeIcon icon={faHourglassHalf} /> Processing image for this student... ({ocrJobs.get(currentStudent._id).progress}%)
                {ocrJobs.get(currentStudent._id).isRetry && ` - Retry ${ocrJobs.get(currentStudent._id).attemptNumber}/${ocrJobs.get(currentStudent._id).maxAttempts}`}
                </>
              )}
              {ocrJobs.get(currentStudent._id).status === 'retrying' && (
                <><FontAwesomeIcon icon={faHourglassHalf} /> Processing failed, retrying... (Attempt {ocrJobs.get(currentStudent._id).attemptNumber}/{ocrJobs.get(currentStudent._id).maxAttempts})
                {ocrJobs.get(currentStudent._id).error && <><br/><small style={{color: '#92400e'}}>Error: {ocrJobs.get(currentStudent._id).error}</small></>}
                </>
              )}
              {ocrJobs.get(currentStudent._id).status === 'failed' && (
                <><FontAwesomeIcon icon={faCircleXmark} /> OCR processing failed after {ocrJobs.get(currentStudent._id).attemptNumber || 3} attempts: {ocrJobs.get(currentStudent._id).error}</>
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
              {!isDistributionValid && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px',
                  padding: '12px 16px', marginBottom: '12px', fontSize: '14px', color: '#92400e'
                }}>
                  ⚠️ <strong>Marks Distribution not set.</strong> Click &ldquo;Marks Distribution&rdquo; above and set each question total to <strong>35</strong> before entering marks.
                </div>
              )}
              <h4>Enter Marks - Section {normalizedSection} (Q{normalizedSection === 'A' ? '1-4' : '5-8'})</h4>
              <div className="marks-table-container" style={{ opacity: isDistributionValid ? 1 : 0.4, pointerEvents: isDistributionValid ? 'auto' : 'none' }}>
                <table className="marks-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Q{normalizedSection === 'A' ? '1' : '5'}</th>
                      <th>Q{normalizedSection === 'A' ? '2' : '6'}</th>
                      <th>Q{normalizedSection === 'A' ? '3' : '7'}</th>
                      <th>Q{normalizedSection === 'A' ? '4' : '8'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(row => (
                      <tr key={row}>
                        <td className="row-label">{row}</td>
                        {(normalizedSection === 'A' ? ['1', '2', '3', '4'] : ['5', '6', '7', '8']).map(question => (
                          <td key={question}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={marks[row][question]}
                              onChange={(e) => handleMarkChange(row, question, e.target.value)}
                              onKeyDown={(e) => handleMarkKeyDown(e, row, question)}
                              data-row={row}
                              data-col={question}
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
        )} {/* end !showMarksDistribution body */}

        {/* Footer with Navigation */}
        {!showMarksDistribution && (
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
        )} {/* end !showMarksDistribution footer */}
        {showMarksDistribution && (
          <div className="modal-body mark-entry-body" style={{ overflowY: 'auto' }}>
          {distLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: '#2563eb' }} />
              <p style={{ color: '#6b7280', marginTop: '8px' }}>Loading...</p>
            </div>
          ) : (
            [{ label: 'Section A', qLabels: ['Q1','Q2','Q3','Q4'], rows: distSectionARows, sec: 'A', totals: distATotals },
             { label: 'Section B', qLabels: ['Q5','Q6','Q7','Q8'], rows: distSectionBRows, sec: 'B', totals: distBTotals }]
            .filter(({ sec }) => sec === normalizedSection)
            .map(({ label, qLabels, rows, sec, totals }) => (
              <div key={sec} style={{ marginBottom: '32px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#047857', color: 'white' }}>
                        <th rowSpan="2" style={{ padding: '12px 16px', border: '1px solid #6ee7b7' }}>CO</th>
                        {qLabels.map((q, qi) => (
                          <th key={q} colSpan="4" style={{ padding: '12px 16px', border: '1px solid #6ee7b7', borderLeft: qi > 0 ? '3px solid #aaa' : undefined }}>{q}</th>
                        ))}
                      </tr>
                      <tr style={{ background: '#059669', color: 'white' }}>
                        {qLabels.map((q, qi) => (
                          ['a','b','c','d'].map((l, li) => (
                            <th key={`${q}${l}`} style={{ padding: '10px 12px', border: '1px solid #6ee7b7', borderLeft: li === 0 && qi > 0 ? '3px solid #aaa' : undefined }}>{l}</th>
                          ))
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.coNumber || idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                          <td style={{ padding: '10px 16px', fontWeight: '600', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{row.coNumber}</td>
                          {['Q1','Q2','Q3','Q4'].map((q, qi) => (
                            ['a','b','c','d'].map((l, li) => (
                              <td key={`${q}${l}`} style={{ padding: '6px', border: '1px solid #ddd', borderLeft: li === 0 && qi > 0 ? '3px solid #aaa' : undefined }}>
                                <input
                                  type="number" min="0"
                                  value={row[`${q}${l}`] || 0}
                                  onChange={e => handleDistCellChange(sec, idx, `${q}${l}`, e.target.value)}
                                  style={{ width: '70px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '4px', padding: '6px 4px', fontSize: 'inherit' }}
                                />
                              </td>
                            ))
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f0f4f8', fontWeight: 'bold' }}>
                        <td style={{ padding: '10px 16px', border: '1px solid #ddd' }}>Total</td>
                        {totals.map((t, qi) => (
                          <td key={qi} colSpan="4" style={{
                            padding: '10px 16px', border: '1px solid #ddd',
                            borderLeft: qi > 0 ? '3px solid #aaa' : undefined,
                            textAlign: 'center',
                            color: t === 35 ? '#27ae60' : '#e74c3c'
                          }}>
                            {t} {t === 35 ? '✓' : '≠ 35'}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkEntry;
