/**
 * Attendance Tutorial Page — Step-by-step guide for marking attendance
 * Visual walkthrough with animations and instructions
 */
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../utils/apiBase';
import {
  Fingerprint, Wifi, WifiOff, Loader, CheckCircle, XCircle,
  ChevronRight, Hand, Smartphone, AlertTriangle, Home,
  Clock, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Attendance',
    subtitle: 'Learn how to mark your attendance',
    icon: Fingerprint,
    description: 'This tutorial will guide you through the fingerprint attendance process in 5 simple steps.',
    color: 'var(--accent-indigo)',
  },
  {
    id: 'sensor_location',
    title: 'Locate the Sensor',
    subtitle: 'Find the fingerprint sensor device',
    icon: Smartphone,
    description: 'Look for the ESP32 fingerprint sensor device in your classroom or designated location. It usually has a blue LED indicator.',
    tips: [
      '🔵 Blue LED indicates the device is online and ready',
      '🔴 Red LED means the device is in registration mode',
      '⚫ No LED means the device is offline',
    ],
    color: 'var(--accent-cyan)',
  },
  {
    id: 'place_finger',
    title: 'Place Your Finger',
    subtitle: 'Touch the sensor with your enrolled finger',
    icon: Hand,
    description: 'Gently place the finger that was registered during enrollment on the sensor. Hold it steady for about 1-2 seconds.',
    tips: [
      '✋ Use the same finger that was enrolled',
      '🧼 Ensure your finger is clean and dry',
      '⏸️ Stay still while scanning',
    ],
    color: 'var(--accent-emerald)',
  },
  {
    id: 'confirmation',
    title: 'Wait for Confirmation',
    subtitle: 'Device processes your fingerprint',
    icon: Clock,
    description: 'The device will beep and show a confirmation message on the screen. Your attendance will be recorded automatically.',
    tips: [
      '🔊 You\'ll hear a beep sound when successful',
      '✅ A green checkmark confirms attendance recorded',
      '❌ Red X means the scan failed - try again',
    ],
    color: 'var(--accent-rose)',
  },
  {
    id: 'completion',
    title: 'All Set!',
    subtitle: 'Your attendance is recorded',
    icon: CheckCircle,
    description: 'Congratulations! Your attendance has been successfully marked. You can view your attendance records in the Attendance section.',
    tips: [
      '📋 Visit "Attendance Records" to see your history',
      '📊 Check your attendance percentage on Dashboard',
      '⏱️ You can only mark attendance once per day',
    ],
    color: 'var(--accent-emerald)',
  },
];

export default function AttendanceTutorial() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState({ isOnline: false, mode: 'attend' });
  const [completedSteps, setCompletedSteps] = useState(new Set());

  useEffect(() => {
    const socket = io(getSocketUrl());
    socket.on('deviceStatus', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });
    socket.on('deviceModeChanged', (data) => {
      setDeviceStatus((prev) => ({ ...prev, ...data }));
    });
    return () => socket.disconnect();
  }, []);

  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    } else {
      toast.success('Tutorial completed!');
      navigate('/attendance');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (index) => {
    setCurrentStep(index);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tutorial</h1>
          <p className="page-subtitle">Learn how to mark your attendance</p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/attendance')}
          title="Skip to Attendance"
        >
          <Home size={16} /> Back
        </button>
      </div>

      {/* Device Status Banner */}
      <div className={`mode-banner ${deviceStatus.mode === 'attend' ? 'attend' : 'enroll'}`}>
        <div className="mode-banner-content">
          {deviceStatus.isOnline ? (
            <>
              <Wifi size={20} style={{ color: 'var(--accent-emerald)' }} />
              <span>Device <strong>online</strong> — ready to receive attendance</span>
              <span className="badge present" style={{ marginLeft: 8 }}>Online</span>
            </>
          ) : (
            <>
              <WifiOff size={20} style={{ color: 'var(--accent-rose)' }} />
              <span>Device <strong>offline</strong> — no sensor detected</span>
              <span className="badge absent" style={{ marginLeft: 8 }}>Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Main Tutorial Content */}
      <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Progress Bar */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              height: 4,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 2,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: 'var(--accent-indigo)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Step {currentStep + 1} of {TUTORIAL_STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Step Content */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: step.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              opacity: 0.2,
            }}
          >
            <Icon size={40} style={{ color: step.color }} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            {step.title}
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            {step.subtitle}
          </p>

          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 32 }}>
            {step.description}
          </p>

          {/* Tips */}
          {step.tips && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 16,
                textAlign: 'left',
                marginBottom: 32,
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                💡 Pro Tips:
              </p>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {step.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      marginBottom: idx < step.tips.length - 1 ? 8 : 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Demo Illustration */}
          {currentStep === 2 && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 8,
                padding: 24,
                marginBottom: 32,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 60, marginBottom: 16 }}>👆</div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Place your finger gently on the sensor
              </p>
            </div>
          )}

          {currentStep === 3 && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 8,
                padding: 24,
                marginBottom: 32,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>
                <Loader size={40} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Processing your fingerprint...
              </p>
            </div>
          )}
        </div>

        {/* Step Indicator Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
          {TUTORIAL_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToStep(idx)}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: idx === currentStep ? '2px solid var(--accent-indigo)' : '2px solid var(--border-subtle)',
                backgroundColor: completedSteps.has(idx) ? 'var(--accent-emerald)' : idx < currentStep ? 'var(--accent-emerald)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <button
            className="btn btn-ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{ opacity: currentStep === 0 ? 0.5 : 1 }}
          >
            ← Previous
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              <>
                <button className="btn btn-ghost" onClick={() => navigate('/attendance')}>
                  Skip to Records
                </button>
                <button className="btn btn-success" onClick={handleNext}>
                  Got It! <CheckCircle size={16} />
                </button>
              </>
            ) : (
              <button className="btn btn-success" onClick={handleNext}>
                Next <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
          📊 Dashboard
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/attendance')}>
          📋 Attendance Records
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/students')}>
          👥 Students
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
