"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import { MultiFileDropzone, type FileState } from "@/components/multi-file-dropzone";
import {detectDateFields} from "@/components/detectDates";
import { useEdgeStore } from "@/lib/edgestore";
import { parse, format } from "date-fns";
import { create, all } from 'mathjs';

const math = create(all);
math.import({
  if: function (condition: any, trueVal: any, falseVal: any) {
    return condition ? trueVal : falseVal;
  }
});

export default function Page() {
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [targetFileStates, setTargetFileStates] = useState<FileState[]>([]);
  const [dateFields, setDateFields] = useState<string[]>([]);
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [csv1Fields, setCsv1Fields] = useState<string[]>([]);
  const [csv2Fields, setCsv2Fields] = useState<string[]>([]);
  const [csv1Data, setCsv1Data] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, { bestMatch: string; score: number }>>({});
  const [csv2Data, setCsv2Data] = useState<any[]>([]);
  const [outputDateFormat, setOutputDateFormat] = useState("dd-MM-yyyy");
  const [fieldMap, setFieldMap] = useState<Record<string,{ mapped: string[], formula: string, customFormula?: string, dateFormat?: string }>>({});
  const { edgestore } = useEdgeStore();

  useEffect(() => {
  if (csv1Fields.length === 0 && csv1Data.length === 0) {
    const fetchCsv1 = async () => {
      const response = await fetch("/test.csv");
      const text = await response.text();

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (result:any) => {
          const fields = result.meta.fields as string[];
          const data = result.data;
          setCsv1Fields(fields);
          setCsv1Data(data);
        },
      });
    };

    fetchCsv1();
  }
}, []);

  useEffect(() => {
  if (csv1Data.length > 0 && csv1Fields.length > 0) {
    const detectedDates = detectDateFields(csv1Data, csv1Fields);
    console.log("Detected date fields:", detectedDates);
    setDateFields(detectedDates);
  }
}, [csv1Data, csv1Fields]);

  function updateFileProgress(key: string, progress: FileState["progress"]) {
    setFileStates((prev) => {
      const newStates = structuredClone(prev);
      const file = newStates.find((f) => f.key === key);
      if (file) file.progress = progress;
      return newStates;
    });
  }

  const getRecommendations = async (csv1Fields: string[], csv2Fields: string[]) => {
  const res = await fetch("/api/recommend-mapping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv1Fields, csv2Fields }),
  });

  const data = await res.json();
  console.log(data.recommendations);
  setRecommendations(data.recommendations);
  return data.recommendations; 
};

  const handleCSVParsing = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: any) => {
        const fields = result.meta.fields as string[];
        const data = result.data;

        setCsv2Fields(fields);
        setCsv2Data(data);
      },
    });
  };

  const handleMappingChange = (csv1Field: string, selectedFields: string[]) => {
    setFieldMap((prev) => ({
      ...prev,
      [csv1Field]: {
        mapped: selectedFields,
        formula: selectedFields.length === 1 ? "" : (prev[csv1Field]?.formula || "concatenate"),
        dateFormat: prev[csv1Field]?.dateFormat,
      },
    }));
  };

  const handleTargetCSVUpload = (addedFiles: FileState[]) => {
  const file = addedFiles[0];
  setTargetFileStates([file]);

  Papa.parse(file.file, {
    header: true,
    skipEmptyLines: true,
    complete: (result: any) => {
      const fields = result.meta.fields as string[];
      const data = result.data;
      setCsv1Fields(fields);
      setCsv1Data(data);
    },
  });
  if(fileStates.length == 1){
  setStep(2);
  }
};


  const handleFormulaChange = (csv1Field: string, formula: string) => {
    setFieldMap((prev) => ({
      ...prev,
      [csv1Field]: {
        ...prev[csv1Field],
        formula,
      },
    }));
  };

  const handleDateFormatChange = (csv1Field: string, formatStr: string) => {
    setFieldMap((prev) => ({
      ...prev,
      [csv1Field]: {
        ...prev[csv1Field],
        dateFormat: formatStr,
      },
    }));
  };

const handleOutputDateChange = (formatStr: string) => {
  setOutputDateFormat(formatStr);
};

const inferFieldTypes = (data: any[], fields: string[]): Record<string, "number" | "string" | "date"> => {
  const types: Record<string, "number" | "string" | "date"> = {};

  fields.forEach((field) => {
    const sample = data.map(row => row[field]).find(v => v !== undefined && v !== null && v !== "");
    if (!sample) {
      types[field] = "string";
    } else if (!isNaN(parseFloat(sample)) && isFinite(sample)) {
      types[field] = "number";
    } else if (dateFields.includes(field)) {
      types[field] = "date";
    } else {
      types[field] = "string";
    }
  });

  return types;
};

const generateMergedData = (): any[] | null => {
  const fieldTypes = inferFieldTypes(csv1Data, csv1Fields);
  if (Object.keys(fieldMap).length !== csv1Fields.length) {
    alert(`Mapping missing for one or more fields in Target CSV`);
    return null;
  }

  const merged: any[] = [];
  let hasInvalidData = false;

  for (let i = 0; i < csv1Data.length; i++) {
    const row1 = csv1Data[i];
    const row2 = csv2Data[i];
    if (!row2) {
      alert(`Missing row ${i + 1} in CSV 2`);
      hasInvalidData = true;
      break;
    }

    const newRow: Record<string, string> = {};

    for (let [csv1Field, { mapped, formula, dateFormat }] of Object.entries(fieldMap)) {
      const expectedType = fieldTypes[csv1Field];
      if ((mapped==undefined) || (mapped==null)|| mapped.length==0){
         alert(`Mapping missing for one or more fields in Target CSV`);
         return null;
      }
      const fieldValues = mapped.map((f) => row2[f]);

      if (fieldValues.some((val) => val === undefined || val === null || val === "")) {
        alert(`Invalid field value in row ${i + 1} for mapping to "${csv1Field}".`);
        hasInvalidData = true;
        break;
      }

      for (let j = 0; j < fieldValues.length; j++) {
        const val = fieldValues[j];

        if (expectedType === "number" && isNaN(parseFloat(val))) {
          alert(`Type mismatch in row ${i + 1} for "${csv1Field}". Expected a number but got "${val}".`);
          hasInvalidData = true;
          break;
        }

        if (expectedType === "date" && dateFormat) {
          const parsed = parse(val, dateFormat, new Date());
          if (isNaN(parsed.getTime())) {
            alert(`Type mismatch in row ${i + 1} for "${csv1Field}". Expected a date in format "${dateFormat}" but got "${val}".`);
            hasInvalidData = true;
            break;
          }
        }
      }

      if (hasInvalidData) break;

      if (expectedType === "date") {
        const rawValue = row2[mapped[0]];
        if (dateFormat && rawValue) {
          try {
            const parsed = parse(rawValue, dateFormat, new Date());
            newRow[csv1Field] = format(parsed, outputDateFormat);
          } catch {
            alert(`Date parsing failed in row ${i + 1} for field "${csv1Field}".`);
            hasInvalidData = true;
            break;
          }
        } else {
          newRow[csv1Field] = rawValue;
        }
      } else if (mapped.length === 1) {
        newRow[csv1Field] = row2[mapped[0]];
      } else {
        console.log(formula);
        if (formula === "concatenate" && expectedType=="string") {
          newRow[csv1Field] = mapped.map((f) => row2[f] || "").join(" ");
        } else if (formula === "+" && expectedType=="number") {
          newRow[csv1Field] = mapped.map((f) => parseFloat(row2[f]) || 0).reduce((a, b) => a + b, 0).toString();
        } else if (formula === "-" && expectedType=="number") {
          newRow[csv1Field] = mapped.map((f) => parseFloat(row2[f]) || 0).reduce((a, b) => a - b).toString();
        }
        else if (formula === "/" && expectedType=="number") {
          newRow[csv1Field] = mapped.map((f) => parseFloat(row2[f]) || 0).reduce((a, b) => a / b).toString();
        }
        else if (formula === "*" && expectedType=="number") {
          newRow[csv1Field] = mapped.map((f) => parseFloat(row2[f]) || 0).reduce((a, b) => a * b).toString();
        }

//if(a > b, 1, 0) for custom output values if(boolean expression,then,else)
//arthimetic based of DMAS a+b-20/100
//simple boolean expression a>b and c>d, and,or,not
  else if (formula === "custom") {
  const rawFormula = fieldMap[csv1Field]?.customFormula || "";
  try {
    const context = { ...row2 };
    const typedContext: Record<string, any> = {};
    for (const [key, value] of Object.entries(context)) {
      const trimmed = (value || "").toString().trim();
      if (!isNaN(trimmed)) {
        typedContext[key] = Number(trimmed);
      } else if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ) {
        typedContext[key] = trimmed.slice(1, -1); 
      } else {
        typedContext[key] = trimmed;
      }
    }
    console.log(rawFormula,typedContext);
    const evaluated = math.evaluate(rawFormula, typedContext);
    newRow[csv1Field] = evaluated?.toString?.() ?? "";
  } catch (err) {
    alert(`Error evaluating custom formula for "${csv1Field}" in row ${i + 1}: ${err}`);
    hasInvalidData = true;
    break;
  }
}

        else{
           alert(`Type mismatch in row ${i + 1} for "${csv1Field}". This formula can not be applied on this type`);
           return null;
        }
      }
    }

    if (hasInvalidData) break;
    merged.push(newRow);
  }

  return hasInvalidData ? null : merged;
};

const generateMergedCSV = () => {
  const merged = generateMergedData();
  if (!merged) return;

  const csvString = Papa.unparse(merged, { fields: csv1Fields });
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "merged.csv";
  a.click();
  URL.revokeObjectURL(url);
};

  const handleFilesAdded = async (addedFiles: FileState[]) => {
    const fileState = addedFiles[0];
    setFileStates([fileState]);

    try {
      const res = await edgestore.myProtectedFiles.upload({
        file: fileState.file,
        onProgressChange: async (progress: any) => {
          updateFileProgress(fileState.key, progress);
          if (progress === 100) {
            await new Promise((r) => setTimeout(r, 500));
            updateFileProgress(fileState.key, "COMPLETE");
          }
        },
      });

      setUrls([res.url]);
      handleCSVParsing(fileState.file);
      if(targetFileStates.length==1){
      setStep(2);
      }
    } catch {
      updateFileProgress(fileState.key, "ERROR");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4 bg-gradient-to-br from-purple-950 via-black to-purple-900 text-purple-100 font-sans">
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&display=swap" rel="stylesheet"></link>
      <h1 className="text-4xl font-extrabold text-pink-300 mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>CSV Field Mapping Dashboard</h1>

      <div className="flex gap-4 my-4">
        <div className={`${step === 1 ? "text-2xl font-bold text-pink-400" : "text-2xl text-purple-300"}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>1. Upload</div>
        <div className={`${step === 2 ? "text-2xl font-bold text-pink-400" : "text-2xl text-purple-300"}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>2. Map</div>
        <div className={`${step === 3 ? "text-2xl font-bold text-pink-400" : "text-2xl text-purple-300"}`} style={{ fontFamily: 'Orbitron, sans-serif' }}>3. Download</div>
      </div>

     {step === 1 && (
   <div className="flex flex-col items-center justify-center min-h-[30vh] w-full">
    <div>
      <h2 className="text-center text-xl font-bold text-pink-300 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        Upload Target CSV 
      </h2>
      <MultiFileDropzone
        value={targetFileStates}
        onChange={(files) => setTargetFileStates(files.slice(0, 1))}
        onFilesAdded={handleTargetCSVUpload}
        className="bg-purple-900/50 border border-pink-500 rounded-lg p-4 shadow-inner neon-box"
      />
    </div>
    <div>
      <h2 className="text-center text-xl font-bold text-pink-300 mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
        Upload Source CSV
      </h2>
      <MultiFileDropzone
        value={fileStates}
        onChange={(files) => setFileStates(files.slice(0, 1))}
        onFilesAdded={handleFilesAdded}
        className="bg-purple-900/50 border border-pink-500 rounded-lg p-6 shadow-inner neon-box"
      />
    </div>
  </div>
)}


      {step === 2 && (
        <div className="grid grid-cols-2 gap-6 w-full max-w-4xl">
          <div>
            <h2 className="text-lg font-semibold mb-2 text-pink-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>Fields from Target CSV</h2>
            {csv1Fields.map((field) => (
              <div key={field} className="mb-4">
                <label className="block font-medium mb-1 text-purple-200 flex justify-between items-center" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {field}
                {recommendations[field]?.bestMatch && (
                <span className="ml-4 text-xs text-white bg-purple-800 px-2 py-1 rounded-full">
                Recommended match: <strong>{recommendations[field].bestMatch}</strong>
                </span>
                )}
                </label>
                <div className="border border-purple-700 rounded p-2 bg-purple-900/40">
                  {csv2Fields.map((f2) => {
                    const isChecked = fieldMap[field]?.mapped?.includes(f2) || false;
                    return (
                      <label key={f2} className="block cursor-pointer text-purple-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        <input
                          type="checkbox"
                          className="mr-2 accent-pink-500 focus:ring focus:ring-pink-400 focus:ring-opacity-50"
                          checked={isChecked}
                          onChange={(e) => {
                            const selected = new Set(fieldMap[field]?.mapped || []);
                            if (e.target.checked) {
                              selected.add(f2);
                            } else {
                              selected.delete(f2);
                            }
                            getRecommendations(csv1Fields,csv2Fields);
                            handleMappingChange(field, Array.from(selected));
                          }}
                        />
                        {f2}
                      </label>
                    );
                  })}
                </div>

                {dateFields.includes(field) && (
                  <div className="mt-2">
                    <label className="mr-2 text-purple-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Date Input Format:</label>
                    <select
                      value={fieldMap[field]?.dateFormat || ""}
                      onChange={(e) => handleDateFormatChange(field, e.target.value)}
                      className="border border-pink-600 bg-purple-900 text-pink-400 p-2 rounded focus:outline-none focus:ring focus:ring-pink-400"
                    >
                      <option value="">Select format</option>
                      <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                      <option value="dd-MM-yyyy">DD-MM-YYYY</option>
                      <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                      <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                    </select>
                    <br/>
                    <br/>
                     <label className="mr-2 text-purple-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Date Output Format:</label>
                    <select
                       value={outputDateFormat}
                      onChange={(e) => handleOutputDateChange(e.target.value)}
                      className="border border-pink-600 bg-purple-900 text-pink-400 p-2 rounded focus:outline-none focus:ring focus:ring-pink-400"
                    >
                      <option value="">Select format</option>
                      <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                      <option value="dd-MM-yyyy">DD-MM-YYYY</option>
                      <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                      <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                    </select>
                  </div>
                  
                )}

                {fieldMap[field]?.mapped.length > 1 && (
                  <div className="mt-2">
                    <label className="mr-2 text-purple-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>Formula:</label>
                    <select
                      value={fieldMap[field]?.formula || ""}
                      onChange={(e) => handleFormulaChange(field, e.target.value)}
                      className="border border-pink-600 bg-purple-900 text-pink-400 p-2 rounded focus:outline-none focus:ring focus:ring-pink-400"
                    >
                      <option value="concatenate">Concatenate</option>
                      <option value="+">Add (+)</option>
                      <option value="-">Subtract (-)</option>
                      <option value="/">Divide (/)</option>
                      <option value="*">Multiply (*)</option>
                      <option value="custom">Custom Formula</option>
                      </select>
                      {fieldMap[field]?.formula === "custom" && (
                      <div className="mt-2">
                      <label className="text-purple-200">Enter Custom Formula:</label>
                      <input
                      type="text"
                      value={fieldMap[field]?.customFormula || ""}
                      onChange={(e) => {
                      setFieldMap((prev) => ({
                      ...prev,
                      [field]: {
                      ...prev[field],
                      customFormula: e.target.value,
                      },
                      }));
                      }}
                      className="w-full p-2 mt-1 rounded bg-purple-800 text-white border border-pink-500"
                      placeholder="Example: FirstName + ' ' + LastName"
                      />
                      </div>
                      )}
                      </div>
                      )}
                      </div>
                      ))}
                      </div>
                      <div>
                      <h2 className="text-lg font-semibold mb-2 text-pink-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>Fields from Source CSV</h2>
                      <ul className="list-disc list-inside text-purple-300" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {csv2Fields.map((field) => (
                      <li key={field}>{field}</li>
                      ))}
                      </ul>
                      </div>
                      </div>
                      )}

      {step === 2 && (
        <button
          onClick={() => setStep(3)}
          className="mt-6 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 shadow-lg transition transform hover:scale-105 neon-button"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          Proceed to Download
        </button>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={generateMergedCSV}
            className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-pink-700 shadow-lg"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Download Merged CSV
          </button>
                    <button
          onClick={() => setStep(2)}
          className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-pink-700 shadow-lg"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
          Back to Mapping
          </button>
          <button
  onClick={() => {
    const merged = generateMergedData();
    if (merged) {
      setPreviewData(merged.slice(0, 10)); //10 rows only for now
    }
  }}
  className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-pink-700 shadow-lg"
  style={{ fontFamily: 'Orbitron, sans-serif' }}
>
  Preview Merged CSV
</button>
{previewData.length > 0 && (
  <div className="mt-4 w-full overflow-auto max-h-96 border border-pink-500 rounded">
    <table className="min-w-full text-sm text-purple-100 bg-purple-950 border-collapse">
      <thead>
        <tr>
          {csv1Fields.map((field) => (
            <th key={field} className="border border-pink-500 px-2 py-1 text-left bg-purple-800">{field}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {previewData.map((row, i) => (
          <tr key={i}>
            {csv1Fields.map((field) => (
              <td key={field} className="border border-pink-500 px-2 py-1">{row[field]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
 <button
            onClick={() => window.location.reload()}
            className="text-purple-700 hover:text-white border border-purple-700 hover:bg-purple-800 focus:ring-4 focus:outline-none focus:ring-purple-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-purple-400 dark:text-purple-400 dark:hover:text-white dark:hover:bg-purple-500 dark:focus:ring-purple-900"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
