import { useState, useEffect, useCallback, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../api';

const MEAL_PRICES = {
  BREAKFAST: 40,
  LUNCH: 60,
  SNACKS: 20,
  DINNER: 60
};
export default function ManagerAttendance() {
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scannedList, setScannedList] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [cost, setCost] = useState(0);

  // Prevent multiple overlapping API calls during continuous scanning
  const processingRef = useRef(false);

  const loadMeal = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.upcomingMeal();
      setMeal(data);
      setCost(MEAL_PRICES[data.meal_type] || 50);
      try {
        const list = await api.getAttendanceList(data.menu_id);
        setScannedList(list);
      } catch (err) {
        console.error("Failed to load attendance list:", err);
      }
    } catch (err) {
      setError(err.message || "Failed to load meal data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeal();
  }, [loadMeal]);

  useEffect(() => {
    if (!isScanning || !meal) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 5, qrbox: { width: 250, height: 250 } },
      false
    );

    async function onScanSuccess(decodedText) {
      if (processingRef.current) return;

      try {
        processingRef.current = true;
        const data = JSON.parse(decodedText);
        
        if (!data.student_id) {
            throw new Error("Invalid Student QR Code");
        }

        const currentCost = parseFloat(cost);
        if (isNaN(currentCost) || currentCost < 0) {
            throw new Error("Invalid deduction amount");
        }

        const res = await api.recordAttendance({
          student_id: data.student_id,
          menu_id: meal.menu_id,
          deduction_amount: currentCost
        });

        // Refresh the full attendance list from the server
        try {
          const updatedList = await api.getAttendanceList(meal.menu_id);
          setScannedList(updatedList);
        } catch (e) {
          console.error("Failed to refresh attendance list:", e);
        }

        const studentName = res.record?.student?.name || "Student";
        
        // Show violation warning if this student polled NO but showed up
        if (res.warning) {
          setScanResult({ type: 'warning', message: res.warning });
          setTimeout(() => setScanResult(null), 6000);
        } else {
          setScanResult({ type: 'success', message: `✅ ${studentName} marked present! (₹${currentCost} deducted)` });
          setTimeout(() => setScanResult(null), 4000);
        }

      } catch (err) {
        setScanResult({ type: 'error', message: err.message || "Invalid QR data." });
        setTimeout(() => setScanResult(null), 3000);
      } finally {
        // Debounce before allowing next scan processing
        setTimeout(() => { processingRef.current = false; }, 1500);
      }
    }

    scanner.render(onScanSuccess, () => {});

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [isScanning, meal, cost]);

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading active meal...</div>;

  if (error && !meal) {
    return (
      <div className="page-header">
        <h1>Attendance Scanner</h1>
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Attendance & Scanner 📷</h1>
        <p>Scan student QR codes to mark attendance and deduct meal costs.</p>
      </div>

      <div className="card-grid" style={{ marginBottom: 24, display: 'block' }}>
        <div className="meal-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Active Meal</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-color)', marginTop: 4 }}>
                {meal.meal_type}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Deduction Cost (₹)</div>
               <input 
                 type="number" 
                 value={cost} 
                 onChange={(e) => setCost(e.target.value)}
                 style={{ 
                   width: '80px', 
                   padding: '6px 12px', 
                   marginTop: 4, 
                   borderRadius: '6px', 
                   border: '1px solid var(--border-color)', 
                   background: 'var(--surface-color)', 
                   color: 'var(--text-color)',
                   fontWeight: 'bold',
                   fontSize: '1rem',
                   textAlign: 'center'
                 }}
               />
            </div>
          </div>
          
          {!isScanning ? (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setIsScanning(true)}>
              Start Scanning
            </button>
          ) : (
            <button className="btn" style={{ width: '100%', background: 'var(--surface-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }} onClick={() => setIsScanning(false)}>
              Stop Camera
            </button>
          )}

        </div>
      </div>

      {isScanning && (
        <div className="meal-card" style={{ padding: 20, textAlign: 'center' }}>
           <div id="qr-reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto', overflow: 'hidden', borderRadius: '12px' }}></div>
           
           <div style={{ minHeight: '60px', marginTop: '20px' }}>
              {scanResult && (
                <div className={`alert ${scanResult.type === 'success' ? 'alert-success' : scanResult.type === 'warning' ? 'alert-error' : 'alert-error'}`} style={{ margin: 0, padding: '12px', animation: 'fadeIn 0.3s ease-in-out', background: scanResult.type === 'warning' ? 'rgba(255, 165, 0, 0.15)' : undefined, borderColor: scanResult.type === 'warning' ? 'rgba(255, 165, 0, 0.4)' : undefined }}>
                  {scanResult.message}
                </div>
              )}
           </div>
        </div>
      )}

      {/* Scanned Students List */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>Currently Attended ({scannedList.length})</h2>
        {scannedList.length === 0 ? (
          <div className="meal-card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No students have scanned in for this meal yet.
          </div>
        ) : (
          <div className="meal-card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Hostel ID</th>
                    <th>Time</th>
                    <th style={{ textAlign: 'right' }}>Deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedList.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.hostel_id}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(item.scanned_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }} className="red">-₹{Number(item.deduction_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
