import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCamera, faUpload, faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import { getTermExamMarks, saveTermExamMarks } from '../services/termExamMarksService';
import { submitOCRJob, getUserOCRJobs, getOCRJobStatus } from '../services/ocrJobService';
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
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null); // Separate ref for mobile camera input
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const currentStudentIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const currentStudent = students[currentStudentIndex];
  
  // Detect if device is mobile
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };
  
  // Update ref whenever current student changes
  useEffect(() => {
    currentStudentIdRef.current = currentStudent._id;
  }, [currentStudent._id]);
  
  // Load OCR jobs for all students on mount
  useEffect(() => {
    const loadOCRJobs = async () => {
      try {
        const response = await getUserOCRJobs({ courseId: course._id });
        if (response.success) {
          const jobsMap = new Map();
          response.data.forEach(job => {
            if (job.student && job.student._id) {
              jobsMap.set(job.student._id, job);
            }
          });
          setOcrJobs(jobsMap);
          console.log('Loaded OCR jobs:', jobsMap.size);
        }
      } catch (error) {
        console.error('Error loading OCR jobs:', error);
      }
    };
    
    loadOCRJobs();
  }, [course._id]);
  
  // Poll active OCR jobs
  useEffect(() => {
    const activeJobs = Array.from(ocrJobs.values()).filter(
      job => job.status === 'pending' || job.status === 'processing'
    );
    
    if (activeJobs.length === 0) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    
    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const response = await getOCRJobStatus(job.jobId);
          if (response.success) {
            const updatedJob = response.data;
            setOcrJobs(prev => {
              const updated = new Map(prev);
              if (updatedJob.student && updatedJob.student._id) {
                updated.set(updatedJob.student._id, updatedJob);
              }
              return updated;
            });
            
            // If job completed, auto-fill marks if viewing this student
            if (updatedJob.status === 'completed' && updatedJob.student._id === currentStudent._id) {
              if (updatedJob.marks) {
                setMarks(updatedJob.marks);
                console.log('Auto-filled marks from completed OCR job');
              }
              if (updatedJob.imageUrl) {
                setCapturedImage(updatedJob.imageUrl);
              }
            }
          }
        } catch (error) {
          console.error(`Error polling job ${job.jobId}:`, error);
        }
      }
    }, 2000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [ocrJobs, currentStudent._id]);

  // Load saved data when student changes
  useEffect(() => {
    const loadStudentMarks = async () => {
      const studentId = currentStudent._id;
      
      let marksLoaded = false;
      let imageLoaded = false;
      
      // Priority 1: Check if there's a completed OCR job
      const ocrJob = ocrJobs.get(studentId);
      if (ocrJob && ocrJob.status === 'completed' && ocrJob.marks) {
        setMarks(ocrJob.marks);
        setCapturedImage(ocrJob.imageUrl);
        marksLoaded = true;
        imageLoaded = true;
        console.log('Loaded from OCR job for', currentStudent.name);
      }
      
      // Priority 2: Check in-memory cache (if not loaded from OCR job)
      if (!marksLoaded && studentData[studentId]) {
        setMarks(studentData[studentId].marks);
        setCapturedImage(studentData[studentId].image);
        marksLoaded = true;
        imageLoaded = true;
        console.log('Loaded from in-memory cache for', currentStudent.name);
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
          if (!imageLoaded) {
            setCapturedImage(validImage);
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
        console.log('No existing marks found for student:', currentStudent.name);
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
          setCapturedImage(null);
        }
      }
    };
    
    loadStudentMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentIndex, currentStudent._id, course._id, section, ocrJobs]);
  
  // Check for unsaved changes
  useEffect(() => {
    if (!savedMarks) {
      // No saved marks in database, check if current marks are empty
      const isEmpty = Object.values(marks).every(q => 
        Object.values(q).every(v => !v || v === '')
      );
      setHasUnsavedChanges(!isEmpty);
      return;
    }
    
    // Compare current marks with saved marks
    const hasChanges = JSON.stringify(marks) !== JSON.stringify(savedMarks);
    setHasUnsavedChanges(hasChanges);
  }, [marks, savedMarks]);

  // Cleanup camera stream on unmount or when camera closes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
      
      canvas.toBlob((blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage(imageUrl);
          stopCamera();
        } else {
          console.error('Failed to create blob from canvas');
          alert('Failed to capture image. Please try again.');
        }
      }, 'image/jpeg', 0.95);
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      setCapturedImage(imageUrl);
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
  };

  // Process image with FastAPI (non-blocking, queue-based)
  const processImage = async () => {
    if (!capturedImage || capturedImage === 'skipped') return;

    const studentId = currentStudent._id;
    
    try {
      // Convert blob URL to base64 if needed
      let imageDataUrl = capturedImage;
      if (capturedImage.startsWith('blob:')) {
        console.log('Converting blob URL to base64...');
        const blob = await fetch(capturedImage).then(r => r.blob());
        imageDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        console.log('Converted to base64, length:', imageDataUrl.length);
      }
      
      // Submit OCR job
      const response = await submitOCRJob(studentId, course._id, section, imageDataUrl);
      
      if (response.success) {
        // Update OCR jobs map with new job
        const newJob = {
          jobId: response.jobId,
          student: { _id: studentId, name: currentStudent.name, roll: currentStudent.roll },
          course: { _id: course._id },
          imageUrl: imageDataUrl,
          status: 'pending',
          progress: 0,
          createdAt: new Date()
        };
        
        setOcrJobs(prev => {
          const updated = new Map(prev);
          updated.set(studentId, newJob);
          return updated;
        });
        
        console.log(`OCR job ${response.jobId} submitted for ${currentStudent.name}`);
        
        // Move to next student immediately
        if (currentStudentIndex < students.length - 1) {
          setCurrentStudentIndex(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error submitting OCR job:', error);
      alert('Failed to submit OCR job. Please try again.');
    }
  };

  // Handle mark change
  const handleMarkChange = (row, question, value) => {
    // Only allow numbers
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    const updatedMarks = {
      ...marks,
      [row]: {
        ...marks[row],
        [question]: value
      }
    };
    
    setMarks(updatedMarks);
    
    // Update in-memory cache
    setStudentData(prev => ({
      ...prev,
      [currentStudent._id]: {
        marks: updatedMarks,
        image: capturedImage
      }
    }));
  };

  // Calculate total marks
  const calculateTotal = () => {
    let total = 0;
    Object.values(marks).forEach(question => {
      Object.values(question).forEach(mark => {
        total += parseFloat(mark) || 0;
      });
    });
    return total.toFixed(2);
  };
  
  // Manual save to database
  const handleSave = async () => {
    const studentId = currentStudent._id;
    const totalMarks = calculateTotal();
    
    try {
      await saveTermExamMarks({
        studentId: studentId,
        courseId: course._id,
        section: section,
        marks: marks,
        totalMarks: parseFloat(totalMarks),
        imageUrl: capturedImage && !capturedImage.startsWith('blob:') && capturedImage !== 'skipped' ? capturedImage : null
      });
      
      console.log('✓ Marks saved for', currentStudent.name, '- Total:', totalMarks);
      
      // Update saved marks to current marks
      setSavedMarks(marks);
      
      // Update in-memory cache
      setStudentData(prev => ({
        ...prev,
        [studentId]: {
          marks: marks,
          image: capturedImage
        }
      }));
      
      alert('Marks saved successfully!');
    } catch (error) {
      console.error('Error saving marks:', error);
      alert('Failed to save marks: ' + error.message);
    }
  };

  // Save and go to next student
  const handleNext = async () => {
    if (hasUnsavedChanges) {
      // Save current student's data to database
      const studentId = currentStudent._id;
      const totalMarks = calculateTotal();
      
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
        
        console.log('✓ Marks saved for', currentStudent.name, '- Total:', totalMarks);
        
        // Update in-memory cache
        setStudentData(prev => ({
          ...prev,
          [studentId]: {
            marks: marks,
            image: capturedImage
          }
        }));
        
      } catch (error) {
        console.error('Error saving marks:', error);
        // Continue anyway - marks saved in memory
      }
    }
    
    if (currentStudentIndex < students.length - 1) {
      // Move to next student - data will be loaded by useEffect
      setCurrentStudentIndex(prev => prev + 1);
    } else {
      // All students completed
      onClose();
    }
  };

  // Go to previous student
  const handlePrevious = () => {
    if (currentStudentIndex > 0) {
      // Save current student's data before moving
      const studentId = currentStudent._id;
      setStudentData(prev => ({
        ...prev,
        [studentId]: {
          marks: marks,
          image: capturedImage
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
      handleJumpToStudent(event.target.value);
      event.target.value = ''; // Clear input after jumping
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
          
          {/* OCR Jobs Status */}
          {ocrJobs.size > 0 && (
            <div style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                OCR Jobs ({Array.from(ocrJobs.values()).filter(j => j.status !== 'completed').length} active)
              </h5>
              {Array.from(ocrJobs.entries()).reverse().slice(0, 3).map(([id, job]) => (
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
                    {job.status === 'pending' && <span style={{ fontSize: '12px', color: '#f59e0b' }}>⏱ Queued</span>}
                    {job.status === 'processing' && (
                      <>
                        <div style={{ width: '80px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${job.progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}>⏳ {job.progress}%</span>
                      </>
                    )}
                    {job.status === 'completed' && <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Done</span>}
                    {job.status === 'failed' && <span style={{ fontSize: '12px', color: '#ef4444' }}>✗ Failed</span>}
                  </div>
                </div>
              ))}
              {ocrJobs.size > 3 && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  +{ocrJobs.size - 3} more jobs...
                </div>
              )}
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
                <>⏱ OCR job queued for this student...</>
              )}
              {ocrJobs.get(currentStudent._id).status === 'processing' && (
                <>⏳ Processing image for this student... ({ocrJobs.get(currentStudent._id).progress}%)</>
              )}
              {ocrJobs.get(currentStudent._id).status === 'failed' && (
                <>✗ OCR processing failed: {ocrJobs.get(currentStudent._id).error}</>
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
              ✓ OCR processing completed! Marks have been auto-filled.
            </div>
          )}

          {/* Image Capture/Upload Section */}
          {!capturedImage && !showCamera && (
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

          {/* Captured Image Preview */}
          {capturedImage && capturedImage !== 'skipped' && (
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
                  disabled={ocrJobs.has(currentStudent._id) && ['pending', 'processing'].includes(ocrJobs.get(currentStudent._id).status)}
                >
                  {ocrJobs.has(currentStudent._id) && ocrJobs.get(currentStudent._id).status === 'pending' ? (
                    <>⏱ Queued...</>
                  ) : ocrJobs.has(currentStudent._id) && ocrJobs.get(currentStudent._id).status === 'processing' ? (
                    <>⏳ Processing...</>
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
                <span className="total-value">{calculateTotal()}</span>
              </div>
            </div>
          )}
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
