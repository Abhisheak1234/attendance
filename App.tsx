import React, { useState, useEffect, useCallback } from 'react';
import { ClassGrade, ClassAttendanceData, DailyAttendanceRecord } from './types';
import { CLASS_GRADES, CLASS_STRENGTHS } from './constants';
import { jsPDF } from 'jspdf';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Initial state for class attendance data
const INITIAL_CLASS_ATTENDANCE_DATA: ClassAttendanceData = CLASS_GRADES.reduce((acc, grade) => {
  acc[grade] = {};
  return acc;
}, {} as ClassAttendanceData);

const GRADE_ROW_COLORS = [
  'bg-blue-200',    // For 6th Grade
  'bg-emerald-200', // For 7th Grade
  'bg-amber-200',   // For 8th Grade
  'bg-indigo-200',  // For 9th Grade
  'bg-rose-200',    // For 10th Grade
];

// Approximate RGB values for PDF rows, corresponding to GRADE_ROW_COLORS
const PDF_GRADE_ROW_COLORS_RGB = [
  [219, 234, 254], // light blue
  [209, 250, 229], // light emerald/green
  [253, 230, 138], // light amber/yellow
  [224, 231, 255], // light indigo
  [255, 228, 230], // light rose/pink
];

function App() {
  const [classAttendanceData, setClassAttendanceData] = useState<ClassAttendanceData>(() => {
    try {
      const storedData = localStorage.getItem('schoolClassAttendanceData');
      if (storedData) {
        // Merge stored data with initial structure to ensure all grades are present
        const parsedData = JSON.parse(storedData);
        return { ...INITIAL_CLASS_ATTENDANCE_DATA, ...parsedData };
      }
      return INITIAL_CLASS_ATTENDANCE_DATA;
    } catch (error) {
      console.error("Failed to load class attendance data from localStorage:", error);
      return INITIAL_CLASS_ATTENDANCE_DATA;
    }
  });

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());

  // New state to track which grade's attendance is being edited for the selected date
  // Stores a map of grade to { present: number, absent: number } for temporary edits
  const [editingDailyAttendance, setEditingDailyAttendance] = useState<
    { [grade in ClassGrade]?: { present: number; absent: number } }
  >({});
  const [isBulkEditing, setIsBulkEditing] = useState<boolean>(false);

  // Save class attendance data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('schoolClassAttendanceData', JSON.stringify(classAttendanceData));
    } catch (error) {
      console.error("Failed to save class attendance data to localStorage:", error);
    }
  }, [classAttendanceData]);

  const goToPreviousDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const d = new Date(prevDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    });
    setEditingDailyAttendance({}); // Exit individual editing mode when date changes
    setIsBulkEditing(false); // Exit bulk editing mode when date changes
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prevDate) => {
      const d = new Date(prevDate);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    });
    setEditingDailyAttendance({}); // Exit individual editing mode when date changes
    setIsBulkEditing(false); // Exit bulk editing mode when date changes
  }, []);

  const handleUpdateDailyClassAttendance = useCallback(
    (grade: ClassGrade, date: string, present: number, absent: number) => {
      setClassAttendanceData((prevData) => {
        const updatedGradeAttendance = {
          ...prevData[grade],
          [date]: { present, absent },
        };
        return {
          ...prevData,
          [grade]: updatedGradeAttendance,
        };
      });
      // Exit individual editing mode for this grade after saving, but not if bulk editing
      if (!isBulkEditing) {
        setEditingDailyAttendance((prev) => {
          const newState = { ...prev };
          delete newState[grade];
          return newState;
        });
      }
    },
    [isBulkEditing]
  );

  const handleEditInputChange = useCallback((grade: ClassGrade, field: 'present' | 'absent', value: number) => {
    setEditingDailyAttendance((prev) => {
      const currentEdit = prev[grade] || { present: 0, absent: 0 };
      return {
        ...prev,
        [grade]: {
          ...currentEdit,
          [field]: value,
        },
      };
    });
  }, []);

  const handleBulkEditClick = useCallback(() => {
    setIsBulkEditing(true);
    // Initialize editingDailyAttendance with current values for all grades
    const initialBulkEditState: { [grade in ClassGrade]?: { present: number; absent: number } } = {};
    CLASS_GRADES.forEach(grade => {
      initialBulkEditState[grade] = classAttendanceData[grade]?.[selectedDate] || { present: 0, absent: 0 };
    });
    setEditingDailyAttendance(initialBulkEditState);
  }, [classAttendanceData, selectedDate]);

  const handleSaveAllClick = useCallback(() => {
    CLASS_GRADES.forEach(grade => {
      const editedRecord = editingDailyAttendance[grade];
      if (editedRecord) {
        handleUpdateDailyClassAttendance(grade, selectedDate, editedRecord.present, editedRecord.absent);
      }
    });
    setEditingDailyAttendance({});
    setIsBulkEditing(false);
  }, [editingDailyAttendance, handleUpdateDailyClassAttendance, selectedDate]);

  const handleCancelBulkEditClick = useCallback(() => {
    setEditingDailyAttendance({});
    setIsBulkEditing(false);
  }, []);

  // Export functions
  const exportToCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Class Grade,Total Strength,Present,Absent,Present Percentage,Absent Percentage\n";

    // Add daily records (unfiltered)
    const allDates = new Set<string>();
    CLASS_GRADES.forEach(grade => {
      if (classAttendanceData[grade]) {
        Object.keys(classAttendanceData[grade]!).forEach(date => allDates.add(date));
      }
    });

    Array.from(allDates).sort().forEach(date => {
      CLASS_GRADES.forEach(grade => {
        const dailyRecord = classAttendanceData[grade]?.[date];
        if (dailyRecord) {
          const totalRecorded = dailyRecord.present + dailyRecord.absent;
          const dailyPresentPercentage = totalRecorded > 0 ? (dailyRecord.present / totalRecorded) * 100 : 0;
          const dailyAbsentPercentage = totalRecorded > 0 ? (dailyRecord.absent / totalRecorded) * 100 : 0;
          csvContent += `${date},${grade},${CLASS_STRENGTHS[grade]},${dailyRecord.present},${dailyRecord.absent},${dailyPresentPercentage.toFixed(1)}%,${dailyAbsentPercentage.toFixed(1)}%\n`;
        }
      });
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `school_attendance_data_${getTodayDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    const doc = new jsPDF();
    const margin = 14;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const rowHeight = 7;
    const headerHeight = 7;
    const textIndent = 1; // Small indent for text inside cells

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SR PRIME SCHOOL ATTENDANCE", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("GOPALAPURAM, KHAMMAM", pageWidth / 2, 28, { align: "center" });

    // --- Daily Attendance Records --- (UNFILTERED)
    let y = 45; // Start Y for daily records

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Daily Attendance Records", margin, y);
    y += 10;

    const allDates = new Set<string>();
    CLASS_GRADES.forEach(grade => {
      if (classAttendanceData[grade]) {
        Object.keys(classAttendanceData[grade]!).forEach(date => allDates.add(date));
      }
    });

    const sortedDates = Array.from(allDates).sort();

    const dailyHeaders = ["Class Grade", "Strength", "Present", "Absent", "Present %", "Absent %"];
    const dailyColWidths = [30, 20, 20, 20, 25, 25];
    const tableWidthDaily = dailyColWidths.reduce((a, b) => a + b, 0);
    const startXDaily = (pageWidth - tableWidthDaily) / 2; // Center daily tables

    const minSpaceForNextDate = 10 + 7 + 7 + (CLASS_GRADES.length * rowHeight) + 5; // Date title + header + min rows + buffer

    sortedDates.forEach(date => {
      if (y + minSpaceForNextDate > pageHeight - margin) { // Check if enough space for next date's section
        doc.addPage();
        y = 20;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Daily Attendance Records (Continued)", margin, y);
        y += 10;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Date: ${date}`, margin, y);
      y += 7;

      // Draw daily table headers
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(52, 152, 219); // Blue for header
      doc.setTextColor(255, 255, 255); // White text
      doc.rect(startXDaily, y, tableWidthDaily, headerHeight, "F");
      doc.setDrawColor(0);
      doc.rect(startXDaily, y, tableWidthDaily, headerHeight);

      let xOffsetDaily = startXDaily + textIndent;
      dailyHeaders.forEach((header, i) => {
        doc.text(header, xOffsetDaily, y + 5);
        xOffsetDaily += dailyColWidths[i];
      });
      y += headerHeight;

      doc.setFont("helvetica", "normal");
      CLASS_GRADES.forEach((grade, gradeIndex) => {
        const dailyRecord = classAttendanceData[grade]?.[date];
        if (dailyRecord) {
          // Check for page break BEFORE drawing a row
          if (y + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = 20;
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Daily Attendance Records (Continued)", margin, y);
            y += 10;
            // Repeat daily table headers on new page
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setFillColor(52, 152, 219);
            doc.setTextColor(255, 255, 255);
            doc.rect(startXDaily, y, tableWidthDaily, headerHeight, "F");
            doc.setDrawColor(0);
            doc.rect(startXDaily, y, tableWidthDaily, headerHeight);

            xOffsetDaily = startXDaily + textIndent;
            dailyHeaders.forEach((header, i) => {
              doc.text(header, xOffsetDaily, y + 5);
              xOffsetDaily += dailyColWidths[i];
            });
            y += headerHeight;
            doc.setFont("helvetica", "normal"); // Reset font for data rows
          }

          const totalRecorded = dailyRecord.present + dailyRecord.absent;
          const dailyPresentPercentage = totalRecorded > 0 ? (dailyRecord.present / totalRecorded) * 100 : 0;
          const dailyAbsentPercentage = totalRecorded > 0 ? (dailyRecord.absent / totalRecorded) * 100 : 0;

          const rowData = [
            grade,
            CLASS_STRENGTHS[grade].toString(),
            dailyRecord.present.toString(),
            dailyRecord.absent.toString(),
            dailyPresentPercentage.toFixed(1) + "%",
            dailyAbsentPercentage.toFixed(1) + "%",
          ];

          const rgb = PDF_GRADE_ROW_COLORS_RGB[gradeIndex % PDF_GRADE_ROW_COLORS_RGB.length];
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.setTextColor(0, 0, 0); // Black text for data rows
          doc.rect(startXDaily, y, tableWidthDaily, rowHeight, "F");
          doc.setDrawColor(0);
          doc.rect(startXDaily, y, tableWidthDaily, rowHeight);

          xOffsetDaily = startXDaily + textIndent;
          rowData.forEach((cell, i) => {
            doc.text(cell, xOffsetDaily, y + 5);
            xOffsetDaily += dailyColWidths[i];
          });
          y += rowHeight;
        }
      });
      y += 5; // Small buffer between dates' tables
    });

    doc.save(`school_attendance_summary_${getTodayDate()}.pdf`);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <header className="bg-white rounded-lg shadow-xl p-6 mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mb-2">SR PRIME SCHOOL ATTENDANCE</h1>
        <p className="text-base sm:text-lg text-gray-600">GOPALAPURAM, KHAMMAM</p>
      </header>

      <main className="max-w-7xl mx-auto">
        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center">
            Daily Class Attendance
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-6 mt-4">
            <button
              onClick={goToPreviousDay}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200"
              aria-label="Previous day"
            >
              &larr; Previous Day
            </button>
            <span className="text-lg sm:text-xl font-semibold text-gray-800">Attendance for {selectedDate}</span>
            <button
              onClick={goToNextDay}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200"
              aria-label="Next day"
            >
              Next Day &rarr;
            </button>
          </div>

          <div className="flex justify-center mb-6">
            {isBulkEditing ? (
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={handleSaveAllClick}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-lg shadow-lg transition duration-200"
                  aria-label="Save all changes for today's attendance"
                >
                  Save All Changes
                </button>
                <button
                  onClick={handleCancelBulkEditClick}
                  className="bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-lg shadow-lg transition duration-200"
                  aria-label="Cancel bulk editing"
                >
                  Cancel Bulk Edit
                </button>
              </div>
            ) : (
              <button
                onClick={handleBulkEditClick}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-5 rounded-lg shadow-lg transition duration-200"
                aria-label="Bulk edit today's attendance"
              >
                Bulk Edit Today's Attendance
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Daily Class Attendance Records">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                    Class Grade
                  </th>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                    Class Strength
                  </th>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                    Present
                  </th>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                    Absent
                  </th>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                    Present %
                  </th>
                  <th scope="col" className="px-2 py-2 text-xs sm:px-4 sm:py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">
                    Absent %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {CLASS_GRADES.map((grade, index) => {
                  const currentDailyRecord = classAttendanceData[grade]?.[selectedDate] || { present: 0, absent: 0 };
                  
                  // Determine if this specific row is being edited (only if bulk editing is active)
                  const isEditingRow = isBulkEditing;
                  const editableRecord = editingDailyAttendance[grade] || currentDailyRecord; // Use edited value if editing, else current

                  // Calculate percentages for the current day's record
                  const totalRecorded = currentDailyRecord.present + currentDailyRecord.absent;
                  const dailyPresentPercentage = totalRecorded > 0 ? (currentDailyRecord.present / totalRecorded) * 100 : 0;
                  const dailyAbsentPercentage = totalRecorded > 0 ? (currentDailyRecord.absent / totalRecorded) * 100 : 0;

                  return (
                    <tr key={grade} className={`${GRADE_ROW_COLORS[index % GRADE_ROW_COLORS.length]} hover:bg-opacity-75 transition-colors duration-150`}>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-left font-medium text-gray-900 whitespace-nowrap">{grade}</td>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-700">{CLASS_STRENGTHS[grade]}</td>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-700">
                        {isEditingRow ? (
                          <input
                            type="number"
                            value={editableRecord.present}
                            onChange={(e) => handleEditInputChange(grade, 'present', parseInt(e.target.value, 10) || 0)}
                            className="w-20 sm:w-24 p-1 border-4 border-indigo-500 rounded text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-sm"
                            min="0"
                            max={CLASS_STRENGTHS[grade]}
                            aria-label={`Edit present count for ${grade} on ${selectedDate}`}
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">{currentDailyRecord.present}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-700">
                        {isEditingRow ? (
                          <input
                            type="number"
                            value={editableRecord.absent}
                            onChange={(e) => handleEditInputChange(grade, 'absent', parseInt(e.target.value, 10) || 0)}
                            className="w-20 sm:w-24 p-1 border-4 border-indigo-500 rounded text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-sm"
                            min="0"
                            max={CLASS_STRENGTHS[grade]}
                            aria-label={`Edit absent count for ${grade} on ${selectedDate}`}
                          />
                        ) : (
                          <span className="font-semibold text-gray-900">{currentDailyRecord.absent}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-green-700 font-bold">
                        {dailyPresentPercentage.toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-red-700 font-bold">
                        {dailyAbsentPercentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-200 font-bold">
                <tr>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-left text-gray-900 whitespace-nowrap">Total</td>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-900">{CLASS_GRADES.reduce((sum, grade) => sum + CLASS_STRENGTHS[grade], 0)}</td>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-900">
                    {CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.present || 0), 0)}
                  </td>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-gray-900">
                    {CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.absent || 0), 0)}
                  </td>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-green-800">
                    {(() => {
                      const totalPresent = CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.present || 0), 0);
                      const totalAbsent = CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.absent || 0), 0);
                      const total = totalPresent + totalAbsent;
                      return total > 0 ? ((totalPresent / total) * 100).toFixed(1) + '%' : '0.0%';
                    })()}
                  </td>
                  <td className="px-2 py-2 text-sm sm:px-4 sm:py-3 text-center text-red-800">
                    {(() => {
                      const totalPresent = CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.present || 0), 0);
                      const totalAbsent = CLASS_GRADES.reduce((sum, grade) => sum + (classAttendanceData[grade]?.[selectedDate]?.absent || 0), 0);
                      const total = totalPresent + totalAbsent;
                      return total > 0 ? ((totalAbsent / total) * 100).toFixed(1) + '%' : '0.0%';
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Export Attendance Data</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-4">
            <button
              onClick={exportToCsv}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-200"
              aria-label="Export data to CSV"
            >
              Export to CSV
            </button>
            <button
              onClick={exportToPdf}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition duration-200"
              aria-label="Export data to PDF"
            >
              Export to PDF
            </button>
          </div>
        </section>
      </main>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} School Attendance Tracker. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;