import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCamera, faUpload, faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import { getTermExamMarks, saveTermExamMarks } from '../services/termExamMarksService';
import '../styles/MarkEntry.css';

const MarkEntry = ({ course, students, section, onClose }) => {
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [marks, setMarks] = useState({
    question1: { a: '', b: '', c: '', d: '' },
    question2: { a: '', b: '', c: '', d: '' },
    question3: { a: '', b: '', c: '', d: '' },
    question4: { a: '', b: '', c: '', d: '' }
  });
  // Store all students' marks and images
  const [studentData, setStudentData] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  // Processing queue and status
  const [processingQueue, setProcessingQueue] = useState(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedMarks, setSavedMarks] = useState(null); // Track marks from database
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const processingAbortControllers = useRef(new Map());
  const currentStudentIdRef = useRef(null);

  const currentStudent = students[currentStudentIndex];
  
  // Update ref whenever current student changes
  useEffect(() => {
    currentStudentIdRef.current = currentStudent._id;
  }, [currentStudent._id]);
  
  // Generate session storage key
  const getSessionKey = (studentId) => {
    return `marks_${course._id}_${studentId}_${section || 'default'}`;
  };

  // Load saved data when student changes
  useEffect(() => {
    const loadStudentMarks = async () => {
      const studentId = currentStudent._id;
      const sessionKey = getSessionKey(studentId);
      
      // Check sessionStorage first for processed data
      const sessionData = sessionStorage.getItem(sessionKey);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          setMarks(parsed.marks);
          setCapturedImage(parsed.image);
          console.log('Loaded from session storage for', currentStudent.name);
        } catch (e) {
          console.error('Error parsing session data:', e);
        }
      }
      
      // Check in-memory cache
      if (studentData[studentId]) {
        setMarks(studentData[studentId].marks);
        setCapturedImage(studentData[studentId].image);
      }
      
      // Fetch from database to compare
      setIsLoadingMarks(true);
      try {
        const response = await getTermExamMarks(studentId, course._id, section);
        if (response.success && response.data) {
          setSavedMarks(response.data.marks); // Track database version
          
          // If no session data, load from database
          if (!sessionData && !studentData[studentId]) {
            setMarks(response.data.marks);
          }
          
          const validImage = response.data.imageUrl && !response.data.imageUrl.startsWith('blob:') ? response.data.imageUrl : null;
          
          // If no session data, load from database
          if (!sessionData && !studentData[studentId]) {
            setCapturedImage(validImage);
          }
          
          // Cache in memory
          setStudentData(prev => ({
            ...prev,
            [studentId]: {
              marks: response.data.marks,
              image: validImage
            }
          }));
        } else {
          // No marks found in database
          setSavedMarks(null);
        }
      } catch (error) {
        // No marks found in database - reset to empty
        console.log('No existing marks found for student:', currentStudent.name);
        setSavedMarks(null);
        if (!sessionData && !studentData[studentId]) {
          setMarks({
            question1: { a: '', b: '', c: '', d: '' },
            question2: { a: '', b: '', c: '', d: '' },
            question3: { a: '', b: '', c: '', d: '' },
            question4: { a: '', b: '', c: '', d: '' }
          });
          setCapturedImage(null);
        }
      } finally {
        setIsLoadingMarks(false);
      }
    };
    
    loadStudentMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentIndex, currentStudent._id, course._id, section]);
  
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
      videoRef.current.srcObject = stream;
      
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

      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
      };
    }
  }, [stream, showCamera]);

  // Initialize camera
  const startCamera = async () => {
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
      question1: { a: '', b: '', c: '', d: '' },
      question2: { a: '', b: '', c: '', d: '' },
      question3: { a: '', b: '', c: '', d: '' },
      question4: { a: '', b: '', c: '', d: '' }
    });
  };

  // Process image with FastAPI (non-blocking, queue-based)
  const processImage = async () => {
    if (!capturedImage || capturedImage === 'skipped') return;

    const studentId = currentStudent._id;
    const sessionKey = getSessionKey(studentId);
    
    // Save image to session storage immediately
    sessionStorage.setItem(sessionKey, JSON.stringify({
      marks: marks,
      image: capturedImage
    }));
    
    // Update queue status
    setProcessingQueue(prev => new Map(prev).set(studentId, {
      status: 'processing',
      studentRoll: currentStudent.roll,
      progress: 0
    }));
    
    // Start background processing
    (async () => {
      try {
        // Convert image URL to blob
        const blob = await fetch(capturedImage).then(r => r.blob());
        
        // Create FormData and append image
        const formData = new FormData();
        formData.append('image', blob, 'answer-sheet.jpg');
        
        // Use XMLHttpRequest to track real upload progress
        const xhr = new XMLHttpRequest();
        const abortController = new AbortController();
        processingAbortControllers.current.set(studentId, xhr);
        
        // Track upload progress (actual progress)
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const uploadProgress = (e.loaded / e.total) * 50; // Upload is 0-50%
            setProcessingQueue(prev => {
              const updated = new Map(prev);
              const item = updated.get(studentId);
              if (item) {
                item.progress = uploadProgress;
                updated.set(studentId, item);
              }
              return updated;
            });
          }
        });
        
        // Handle response
        const response = await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                reject(new Error('Invalid JSON response'));
              }
            } else {
              reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred'));
          });
          
          xhr.addEventListener('abort', () => {
            reject(new Error('Request was aborted'));
          });
          
          // Start processing phase (50-100%)
          xhr.addEventListener('loadstart', () => {
            setProcessingQueue(prev => {
              const updated = new Map(prev);
              const item = updated.get(studentId);
              if (item) {
                item.progress = 50;
                updated.set(studentId, item);
              }
              return updated;
            });
          });
          
          xhr.open('POST', '/ml-api/extract-marks');
          xhr.send(formData);
        });
        
        if (response.success && response.marks) {
          // Save to session storage
          sessionStorage.setItem(sessionKey, JSON.stringify({
            marks: response.marks,
            image: capturedImage,
            processed: true
          }));
          
          // Update marks ONLY if still on same student (using ref for current value)
          if (currentStudentIdRef.current === studentId) {
            setMarks(response.marks);
          }
          
          // Update queue status to completed
          setProcessingQueue(prev => {
            const updated = new Map(prev);
            updated.set(studentId, {
              status: 'completed',
              studentRoll: currentStudent.roll,
              progress: 100,
              marks: response.marks
            });
            return updated;
          });
          
          console.log('✓ Marks extracted for roll:', currentStudent.roll);
        } else {
          throw new Error(response.message || 'Failed to extract marks from image');
        }

      } catch (error) {
        console.error('Error processing image for', currentStudent.name, ':', error);
        
        // Update queue status to failed
        setProcessingQueue(prev => {
          const updated = new Map(prev);
          updated.set(studentId, {
            status: 'failed',
            studentRoll: currentStudent.roll,
            progress: 0,
            error: error.message
          });
          return updated;
        });
      } finally {
        processingAbortControllers.current.delete(studentId);
      }
    })();
  };

  // Handle mark change
  const handleMarkChange = (question, part, value) => {
    // Only allow numbers
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    const updatedMarks = {
      ...marks,
      [question]: {
        ...marks[question],
        [part]: value
      }
    };
    
    setMarks(updatedMarks);
    
    // Save to session storage
    const sessionKey = getSessionKey(currentStudent._id);
    sessionStorage.setItem(sessionKey, JSON.stringify({
      marks: updatedMarks,
      image: capturedImage
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
          
          {/* Processing Queue Status */}
          {processingQueue.size > 0 && (
            <div style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                Background Processing ({processingQueue.size})
              </h5>
              {Array.from(processingQueue.entries()).reverse().slice(0, 3).map(([id, info]) => (
                <div key={id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid #e5e7eb'
                }}>
                  <span style={{ fontSize: '13px' }}>Roll: {info.studentRoll}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {info.status === 'processing' && (
                      <>
                        <div style={{ width: '80px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${info.progress}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}>⏳</span>
                      </>
                    )}
                    {info.status === 'completed' && <span style={{ fontSize: '12px', color: '#10b981' }}>✓ Done</span>}
                    {info.status === 'failed' && <span style={{ fontSize: '12px', color: '#ef4444' }}>✗ Failed</span>}
                  </div>
                </div>
              ))}
              {processingQueue.size > 3 && (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  +{processingQueue.size - 3} more processing...
                </div>
              )}
            </div>
          )}
          
          {/* Current student processing status */}
          {processingQueue.has(currentStudent._id) && (
            <div style={{
              background: processingQueue.get(currentStudent._id).status === 'completed' ? '#d1fae5' : 
                         processingQueue.get(currentStudent._id).status === 'failed' ? '#fee2e2' : '#dbeafe',
              border: '1px solid',
              borderColor: processingQueue.get(currentStudent._id).status === 'completed' ? '#10b981' : 
                           processingQueue.get(currentStudent._id).status === 'failed' ? '#ef4444' : '#3b82f6',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {processingQueue.get(currentStudent._id).status === 'processing' && (
                <>⏳ Processing image for this student... ({Math.round(processingQueue.get(currentStudent._id).progress)}%)</>
              )}
              {processingQueue.get(currentStudent._id).status === 'completed' && (
                <>✓ Processing completed! Marks have been extracted.</>
              )}
              {processingQueue.get(currentStudent._id).status === 'failed' && (
                <>✗ Processing failed: {processingQueue.get(currentStudent._id).error}</>
              )}
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
                <button className="btn btn-primary" onClick={processImage}>
                  Process Image
                </button>
              </div>
            </div>
          )}

          {/* Marks Entry Form */}
          {(capturedImage || showCamera === false) && (
            <div className="marks-form-section">
              <h4>Enter Marks</h4>
              <div className="marks-grid">
                {[1, 2, 3, 4].map(qNum => (
                  <div key={qNum} className="question-marks">
                    <h5>Question {qNum}</h5>
                    <div className="parts-grid">
                      {['a', 'b', 'c', 'd'].map(part => (
                        <div key={part} className="mark-input-group">
                          <label>{part.toUpperCase()}</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={marks[`question${qNum}`][part]}
                            onChange={(e) => handleMarkChange(`question${qNum}`, part, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
