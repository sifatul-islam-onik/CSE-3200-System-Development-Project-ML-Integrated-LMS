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
  const [maxTermExamMarks, setMaxTermExamMarks] = useState(105); // Maximum possible marks for term exam
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const currentStudent = students[currentStudentIndex];

  // Debug check on mount
  useEffect(() => {
    if (course.course_type === 'THEORY' && !section) {
       console.warn('MarkEntry mounted with NULL section for THEORY course!');
       // Optional: alert('Warning: No section detected. Marks might not save correctly.');
    }
  }, [course, section]);

  // Load saved data when student changes
  useEffect(() => {
    const loadStudentMarks = async () => {
      const studentId = currentStudent._id;
      
      // Check in-memory cache first
      if (studentData[studentId]) {
        setMarks(studentData[studentId].marks);
        setCapturedImage(studentData[studentId].image);
        return;
      }
      
      // Fetch from database
      setIsLoadingMarks(true);
      try {
        console.log('=== FRONTEND: Loading marks ===');
        console.log('studentId:', studentId);
        console.log('courseId:', course._id);
        console.log('section:', section);
        console.log('section type:', typeof section);
        
        const response = await getTermExamMarks(studentId, course._id, section);
        
        console.log('Response:', response);
        
        if (response.success && response.data) {
          setMarks(response.data.marks);
          // Only set image if it's a valid URL (not a blob URL from previous bad saves)
          const validImage = response.data.imageUrl && !response.data.imageUrl.startsWith('blob:') ? response.data.imageUrl : null;
          setCapturedImage(validImage);
          // Cache in memory
          setStudentData(prev => ({
            ...prev,
            [studentId]: {
              marks: response.data.marks,
              image: validImage
            }
          }));
        }
      } catch (error) {
        // No marks found in database - reset to empty
        console.log('No existing marks found for student:', currentStudent.name);
        console.error('Error:', error.response?.data || error.message);
        setMarks({
          question1: { a: '', b: '', c: '', d: '' },
          question2: { a: '', b: '', c: '', d: '' },
          question3: { a: '', b: '', c: '', d: '' },
          question4: { a: '', b: '', c: '', d: '' }
        });
        setCapturedImage(null);
      } finally {
        setIsLoadingMarks(false);
      }
    };
    
    loadStudentMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentIndex, currentStudent._id, course._id, section]);

  // Cleanup camera stream on unmount or when camera closes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Initialize camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
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
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        stopCamera();
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

  // Process image with FastAPI
  const processImage = async () => {
    if (!capturedImage || capturedImage === 'skipped') return;

    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Convert image URL to blob
      const blob = await fetch(capturedImage).then(r => r.blob());
      
      // Create FormData and append image
      const formData = new FormData();
      formData.append('image', blob, 'answer-sheet.jpg');
      
      // Use XMLHttpRequest to track real upload progress
      const xhr = new XMLHttpRequest();
      
      // Track upload progress (actual progress)
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const uploadProgress = (e.loaded / e.total) * 50; // Upload is 0-50%
          setProcessingProgress(uploadProgress);
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
          setProcessingProgress(50);
        });
        
        xhr.open('POST', 'http://localhost:8000/api/extract-marks');
        xhr.send(formData);
      });
      
      setProcessingProgress(90);
      
      if (response.success && response.marks) {
        // Set extracted marks
        setMarks(response.marks);
        setProcessingProgress(100);
        console.log('Marks extracted successfully:', response);
        console.log('Confidence:', response.confidence);
        if (response.raw_table) {
          console.log('Raw table detected:', response.raw_table);
        }
      } else {
        throw new Error(response.message || 'Failed to extract marks from image');
      }

    } catch (error) {
      console.error('Error processing image:', error);
      alert(`Failed to process image: ${error.message}. Please enter marks manually.`);
      // Allow manual entry if OCR fails
      setMarks({
        question1: { a: '', b: '', c: '', d: '' },
        question2: { a: '', b: '', c: '', d: '' },
        question3: { a: '', b: '', c: '', d: '' },
        question4: { a: '', b: '', c: '', d: '' }
      });
    } finally {
      setProcessingProgress(100);
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
      }, 500);
    }
  };

  // Handle mark change
  const handleMarkChange = (question, part, value) => {
    // Only allow numbers
    if (value && !/^\d*\.?\d*$/.test(value)) return;
    
    setMarks(prev => ({
      ...prev,
      [question]: {
        ...prev[question],
        [part]: value
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

  // Save and go to next student
  const handleNext = async () => {
    // Save current student's data to database
    const studentId = currentStudent._id;
    const marksObtained = calculateTotal();
    
    try {
      console.log('=== FRONTEND: Saving marks ===');
      console.log('studentId:', studentId);
      console.log('courseId:', course._id);
      console.log('section:', section);
      console.log('section type:', typeof section);
      console.log('marks:', marks);
      console.log('marksObtained:', marksObtained);
      console.log('totalMarks (max):', maxTermExamMarks);
      
      await saveTermExamMarks({
        studentId: studentId,
        courseId: course._id,
        section: section,
        academicYear: new Date().getFullYear().toString(), // Current academic year
        marks: marks,
        marksObtained: parseFloat(marksObtained),
        totalMarks: maxTermExamMarks, // Maximum possible marks
        // Don't save blob URLs to database as they expire
        imageUrl: capturedImage && !capturedImage.startsWith('blob:') && capturedImage !== 'skipped' ? capturedImage : null
      });
      
      console.log('✓ Marks saved for', currentStudent.name, '- Obtained:', marksObtained, '/', maxTermExamMarks);
      
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
      alert(`Error saving marks: ${error.response?.data?.message || error.message}. \n\nCheck console for details.`);
      // We do NOT move into next student if save failed, so user knows!
      return; 
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
            <h3>{course.courseCode} - Term Exam Marks Entry {section && <span className="badge bg-primary">Section {section}</span>}</h3>
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
              <video ref={videoRef} autoPlay playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="camera-controls">
                <button className="btn btn-outline" onClick={stopCamera}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={capturePhoto}>
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
                {isProcessing && (
                  <div className="processing-overlay">
                    <div className="spinner-container">
                      <svg className="progress-ring" width="60" height="60">
                        <circle
                          className="progress-ring-circle"
                          stroke="#3b82f6"
                          strokeWidth="4"
                          fill="transparent"
                          r="26"
                          cx="30"
                          cy="30"
                        />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
              <div className="image-actions">
                <button className="btn btn-outline" onClick={handleRetake}>
                  <FontAwesomeIcon icon={faCamera} /> Retake
                </button>
                {!isProcessing && (
                  <button className="btn btn-primary" onClick={processImage}>
                    Process Image
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Marks Entry Form */}
          {(capturedImage || showCamera === false) && (
            <div className="marks-form-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Enter Marks</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500' }}>Max Marks:</label>
                  <input
                    type="number"
                    value={maxTermExamMarks}
                    onChange={(e) => setMaxTermExamMarks(parseFloat(e.target.value) || 0)}
                    style={{ width: '80px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
              </div>
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
                <strong>Marks Obtained:</strong>
                <span className="total-value">{calculateTotal()} / {maxTermExamMarks}</span>
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
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
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
