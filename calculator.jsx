import { useState, useCallback, useEffect } from "react";

// ─── Matrix helpers ───────────────────────────────────────────────────────────
function matMul(A, B, n) {
  const C = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) C[i][j] += A[i][k] * B[k][j];
  return C;
}
function matDet(M, n) {
  if (n === 1) return M[0][0];
  if (n === 2) return M[0][0] * M[1][1] - M[0][1] * M[1][0];
  let det = 0;
  for (let c = 0; c < n; c++) {
    const sub = M.slice(1).map((r) => r.filter((_, j) => j !== c));
    det += (c % 2 === 0 ? 1 : -1) * M[0][c] * matDet(sub, n - 1);
  }
  return det;
}
function matInv(M, n) {
  const det = matDet(M, n);
  if (Math.abs(det) < 1e-10) return null;
  const cofactor = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const sub = M.filter((_, r) => r !== i).map((r) => r.filter((_, c) => c !== j));
      return ((i + j) % 2 === 0 ? 1 : -1) * matDet(sub, n - 1);
    })
  );
  const adj = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => cofactor[j][i])
  );
  return adj.map((r) => r.map((v) => v / det));
}

// ─── Stats helpers ────────────────────────────────────────────────────────────
function parseNums(s) {
  return s.split(",").map((x) => parseFloat(x.trim())).filter((x) => !isNaN(x));
}
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}
function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let f = 1; for (let i = 2; i <= n; i++) f *= i; return f;
}
function perm(n, r) { return factorial(n) / factorial(n - r); }
function comb(n, r) { return factorial(n) / (factorial(r) * factorial(n - r)); }

// ─── Main component ───────────────────────────────────────────────────────────
export default function Calculator() {
  const [mode, setMode] = useState("sci"); // "basic" | "sci" | "matrix" | "stat"
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [memory, setMemory] = useState(0);
  const [angleUnit, setAngleUnit] = useState("deg"); // "deg" | "rad"
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Matrix state
  const [matSize, setMatSize] = useState(2);
  const [matA, setMatA] = useState(Array.from({ length: 4 }, () => Array(4).fill("")));
  const [matB, setMatB] = useState(Array.from({ length: 4 }, () => Array(4).fill("")));
  const [matResult, setMatResult] = useState(null);
  const [matOp, setMatOp] = useState("mul");

  // Stat state
  const [statInput, setStatInput] = useState("");
  const [statResult, setStatResult] = useState(null);

  // ─── Basic / Sci calculator logic ────────────────────────────────────────
  const toRad = (v) => (angleUnit === "deg" ? (v * Math.PI) / 180 : v);

  const appendToExpr = (val) => {
    setExpr((e) => {
      const next = e === "0" || e === "Error" ? val : e + val;
      return next;
    });
    setDisplay((d) => (d === "0" || d === "Error" ? val : d + val));
  };

  const clearAll = () => { setDisplay("0"); setExpr(""); };
  const clearEntry = () => {
    setDisplay("0");
    setExpr((e) => e.slice(0, -1) || "");
  };

  const applyFn = (fn) => {
    const val = parseFloat(display.replace(/[^0-9.\-e]/g, "")) || 0;
    let res;
    try {
      switch (fn) {
        case "sin": res = Math.sin(toRad(val)); break;
        case "cos": res = Math.cos(toRad(val)); break;
        case "tan": res = Math.tan(toRad(val)); break;
        case "asin": res = angleUnit === "deg" ? (Math.asin(val) * 180) / Math.PI : Math.asin(val); break;
        case "acos": res = angleUnit === "deg" ? (Math.acos(val) * 180) / Math.PI : Math.acos(val); break;
        case "atan": res = angleUnit === "deg" ? (Math.atan(val) * 180) / Math.PI : Math.atan(val); break;
        case "sinh": res = Math.sinh(val); break;
        case "cosh": res = Math.cosh(val); break;
        case "tanh": res = Math.tanh(val); break;
        case "asinh": res = Math.asinh(val); break;
        case "acosh": res = Math.acosh(val); break;
        case "atanh": res = Math.atanh(val); break;
        case "ln": res = Math.log(val); break;
        case "log": res = Math.log10(val); break;
        case "log2": res = Math.log2(val); break;
        case "sqrt": res = Math.sqrt(val); break;
        case "cbrt": res = Math.cbrt(val); break;
        case "exp": res = Math.exp(val); break;
        case "sq": res = val * val; break;
        case "cube": res = val * val * val; break;
        case "inv": res = 1 / val; break;
        case "abs": res = Math.abs(val); break;
        case "floor": res = Math.floor(val); break;
        case "ceil": res = Math.ceil(val); break;
        case "round": res = Math.round(val); break;
        case "fact": res = factorial(val); break;
        default: res = val;
      }
      const formatted = fmt(res);
      setHistory((h) => [`${fn}(${val}) = ${formatted}`, ...h].slice(0, 20));
      setDisplay(formatted);
      setExpr(formatted);
    } catch { setDisplay("Error"); setExpr(""); }
  };

  const compute = useCallback(() => {
    try {
      // Replace ^ with ** for exponentiation
      let e = expr.replace(/\^/g, "**").replace(/π/g, Math.PI).replace(/e(?![0-9])/g, Math.E);
      // eslint-disable-next-line no-new-func
      const res = Function('"use strict"; return (' + e + ")")();
      const formatted = fmt(res);
      setHistory((h) => [`${expr} = ${formatted}`, ...h].slice(0, 20));
      setDisplay(formatted);
      setExpr(formatted);
    } catch { setDisplay("Error"); setExpr(""); }
  }, [expr]);

  const fmt = (n) => {
    if (!isFinite(n)) return n > 0 ? "∞" : n < 0 ? "-∞" : "Error";
    if (isNaN(n)) return "Error";
    const s = parseFloat(n.toPrecision(10));
    return String(s);
  };

  // Perm / Comb needs two operands — use a simple prompt via state
  const [pendingOp, setPendingOp] = useState(null);
  const [firstVal, setFirstVal] = useState(null);

  const startTwoOp = (op) => {
    setFirstVal(parseFloat(display));
    setPendingOp(op);
    setDisplay("0");
    setExpr("");
  };

  const finishTwoOp = () => {
    const n = firstVal, r = parseFloat(display);
    let res;
    if (pendingOp === "P") res = perm(n, r);
    else if (pendingOp === "C") res = comb(n, r);
    const formatted = fmt(res);
    setHistory((h) => [`${pendingOp}(${n},${r}) = ${formatted}`, ...h].slice(0, 20));
    setDisplay(formatted);
    setExpr(formatted);
    setPendingOp(null);
    setFirstVal(null);
  };

  // ─── Matrix ────────────────────────────────────────────────────────────────
  const getMat = (src) =>
    Array.from({ length: matSize }, (_, i) =>
      Array.from({ length: matSize }, (_, j) => parseFloat(src[i][j]) || 0)
    );

  const computeMatrix = () => {
    const A = getMat(matA), B = getMat(matB);
    let res, label;
    try {
      if (matOp === "mul") { res = matMul(A, B, matSize); label = "A × B"; }
      else if (matOp === "add") { res = A.map((r, i) => r.map((v, j) => v + B[i][j])); label = "A + B"; }
      else if (matOp === "sub") { res = A.map((r, i) => r.map((v, j) => v - B[i][j])); label = "A − B"; }
      else if (matOp === "detA") { res = [[matDet(A, matSize)]]; label = "det(A)"; }
      else if (matOp === "detB") { res = [[matDet(B, matSize)]]; label = "det(B)"; }
      else if (matOp === "invA") { res = matInv(A, matSize); if (!res) { setMatResult("Singular matrix"); return; } label = "A⁻¹"; }
      else if (matOp === "invB") { res = matInv(B, matSize); if (!res) { setMatResult("Singular matrix"); return; } label = "B⁻¹"; }
      else if (matOp === "transA") { res = A[0].map((_, j) => A.map((r) => r[j])); label = "Aᵀ"; }
      else if (matOp === "transB") { res = B[0].map((_, j) => B.map((r) => r[j])); label = "Bᵀ"; }
      setMatResult({ label, data: res });
    } catch { setMatResult("Error"); }
  };

  const updateCell = (setter, i, j, val) =>
    setter((prev) => { const n = prev.map((r) => [...r]); n[i][j] = val; return n; });

  // ─── Statistics ────────────────────────────────────────────────────────────
  const computeStats = () => {
    const nums = parseNums(statInput);
    if (!nums.length) { setStatResult("No valid numbers"); return; }
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const freq = {};
    nums.forEach((n) => (freq[n] = (freq[n] || 0) + 1));
    const maxF = Math.max(...Object.values(freq));
    const modes = Object.keys(freq).filter((k) => freq[k] === maxF).map(Number);
    setStatResult({
      n: nums.length,
      sum: nums.reduce((a, b) => a + b, 0),
      mean: mean(nums),
      median,
      mode: modes,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      stddev: stddev(nums),
      variance: stddev(nums) ** 2,
    });
  };

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (mode !== "sci" && mode !== "basic") return;
      if ("0123456789.".includes(e.key)) appendToExpr(e.key);
      else if ("+-*/".includes(e.key)) appendToExpr(e.key);
      else if (e.key === "Enter" || e.key === "=") compute();
      else if (e.key === "Escape") clearAll();
      else if (e.key === "Backspace") clearEntry();
      else if (e.key === "(" || e.key === ")") appendToExpr(e.key);
      else if (e.key === "^") appendToExpr("^");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, compute]);

  // ─── Styles ────────────────────────────────────────────────────────────────
  const styles = {
    app: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #12121e 50%, #0d0d18 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      padding: "16px",
    },
    card: {
      width: "100%",
      maxWidth: "480px",
      background: "rgba(255,255,255,0.04)",
      borderRadius: "24px",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
      boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)",
      overflow: "hidden",
    },
    header: {
      padding: "20px 20px 0",
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
    },
    modeBtn: (active) => ({
      padding: "6px 14px",
      borderRadius: "100px",
      border: "1px solid",
      borderColor: active ? "#6366f1" : "rgba(255,255,255,0.1)",
      background: active ? "rgba(99,102,241,0.25)" : "transparent",
      color: active ? "#a5b4fc" : "rgba(255,255,255,0.4)",
      fontSize: "11px",
      fontFamily: "inherit",
      fontWeight: active ? "700" : "400",
      cursor: "pointer",
      letterSpacing: "0.5px",
      textTransform: "uppercase",
      transition: "all 0.2s",
    }),
    display: {
      margin: "16px 20px 0",
      background: "rgba(0,0,0,0.35)",
      borderRadius: "16px",
      padding: "16px 20px 12px",
      border: "1px solid rgba(255,255,255,0.06)",
    },
    exprLine: {
      color: "rgba(255,255,255,0.3)",
      fontSize: "12px",
      minHeight: "16px",
      textAlign: "right",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      letterSpacing: "0.5px",
    },
    mainDisplay: {
      color: "#e0e7ff",
      fontSize: "clamp(22px, 6vw, 36px)",
      textAlign: "right",
      fontWeight: "300",
      letterSpacing: "-0.5px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      marginTop: "4px",
    },
    memDisplay: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "6px",
      fontSize: "10px",
    },
    grid: (cols) => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: "8px",
      padding: "16px 20px 20px",
    }),
    btn: (type = "num") => {
      const configs = {
        num: { bg: "rgba(255,255,255,0.07)", color: "#e0e7ff", hover: "rgba(255,255,255,0.12)" },
        op: { bg: "rgba(99,102,241,0.15)", color: "#a5b4fc", hover: "rgba(99,102,241,0.28)" },
        fn: { bg: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", hover: "rgba(255,255,255,0.1)" },
        eq: { bg: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", hover: "linear-gradient(135deg,#7c3aed,#6366f1)" },
        clear: { bg: "rgba(239,68,68,0.15)", color: "#fca5a5", hover: "rgba(239,68,68,0.28)" },
        mem: { bg: "rgba(16,185,129,0.1)", color: "#6ee7b7", hover: "rgba(16,185,129,0.2)" },
        const: { bg: "rgba(245,158,11,0.1)", color: "#fcd34d", hover: "rgba(245,158,11,0.2)" },
      };
      const c = configs[type] || configs.num;
      return {
        background: c.bg,
        color: c.color,
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "0",
        height: "48px",
        fontSize: "13px",
        fontFamily: "inherit",
        fontWeight: "500",
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.3px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
    },
    sectionTitle: {
      color: "rgba(255,255,255,0.3)",
      fontSize: "10px",
      letterSpacing: "2px",
      textTransform: "uppercase",
      padding: "0 20px 8px",
    },
    input: {
      width: "100%",
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "10px",
      color: "#e0e7ff",
      fontFamily: "inherit",
      fontSize: "13px",
      padding: "10px 14px",
      boxSizing: "border-box",
      outline: "none",
    },
    matCell: {
      width: "100%",
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px",
      color: "#e0e7ff",
      fontFamily: "inherit",
      fontSize: "13px",
      padding: "6px",
      textAlign: "center",
      boxSizing: "border-box",
      outline: "none",
    },
    resultBox: {
      margin: "0 20px 20px",
      background: "rgba(99,102,241,0.08)",
      border: "1px solid rgba(99,102,241,0.2)",
      borderRadius: "12px",
      padding: "14px 16px",
      color: "#a5b4fc",
      fontSize: "12px",
      lineHeight: "1.8",
    },
    statRow: {
      display: "flex",
      justifyContent: "space-between",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      padding: "3px 0",
    },
    historyPanel: {
      maxHeight: "160px",
      overflowY: "auto",
      margin: "0 20px 16px",
      background: "rgba(0,0,0,0.25)",
      borderRadius: "10px",
      padding: "10px 12px",
    },
    histEntry: {
      fontSize: "11px",
      color: "rgba(255,255,255,0.35)",
      padding: "2px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
    },
  };

  // ─── Sub-component for a button ────────────────────────────────────────────
  const Btn = ({ label, type = "num", onClick, span = 1, title }) => (
    <button
      style={{ ...styles.btn(type), gridColumn: span > 1 ? `span ${span}` : undefined }}
      onClick={onClick}
      title={title}
      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
    >
      {label}
    </button>
  );

  // ─── Angle toggle pill ─────────────────────────────────────────────────────
  const AnglePill = () => (
    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
      {["deg", "rad"].map((u) => (
        <button
          key={u}
          onClick={() => setAngleUnit(u)}
          style={{
            ...styles.modeBtn(angleUnit === u),
            padding: "3px 10px",
            fontSize: "10px",
          }}
        >
          {u.toUpperCase()}
        </button>
      ))}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      <div style={styles.card}>
        {/* Mode tabs */}
        <div style={styles.header}>
          {["basic", "sci", "matrix", "stat"].map((m) => (
            <button key={m} style={styles.modeBtn(mode === m)} onClick={() => setMode(m)}>
              {m === "basic" ? "Basic" : m === "sci" ? "Scientific" : m === "matrix" ? "Matrix" : "Statistics"}
            </button>
          ))}
          <button
            style={{ ...styles.modeBtn(showHistory), marginLeft: "auto" }}
            onClick={() => setShowHistory((s) => !s)}
          >
            History
          </button>
        </div>

        {/* History panel */}
        {showHistory && (
          <div style={styles.historyPanel}>
            {history.length === 0 ? (
              <div style={{ ...styles.histEntry, color: "rgba(255,255,255,0.2)" }}>No history yet</div>
            ) : (
              history.map((h, i) => <div key={i} style={styles.histEntry}>{h}</div>)
            )}
          </div>
        )}

        {/* ── BASIC / SCIENTIFIC ── */}
        {(mode === "basic" || mode === "sci") && (
          <>
            {/* Display */}
            <div style={styles.display}>
              {pendingOp && (
                <div style={{ ...styles.exprLine, color: "#fcd34d" }}>
                  {pendingOp}({firstVal}, ?)
                </div>
              )}
              <div style={styles.exprLine}>{expr || "‎"}</div>
              <div style={styles.mainDisplay}>{display}</div>
              <div style={styles.memDisplay}>
                <span style={{ color: memory !== 0 ? "#6ee7b7" : "rgba(255,255,255,0.2)" }}>
                  M: {memory !== 0 ? fmt(memory) : "—"}
                </span>
                {mode === "sci" && <AnglePill />}
              </div>
            </div>

            {/* Scientific functions */}
            {mode === "sci" && (
              <>
                <div style={{ ...styles.grid(5), paddingBottom: "4px", gap: "6px" }}>
                  {/* Trig */}
                  {["sin","cos","tan","asin","acos"].map((f) => (
                    <Btn key={f} label={f} type="fn" onClick={() => applyFn(f)} />
                  ))}
                  {["atan","sinh","cosh","tanh","asinh"].map((f) => (
                    <Btn key={f} label={f} type="fn" onClick={() => applyFn(f)} />
                  ))}
                  {["acosh","atanh","ln","log","log2"].map((f) => (
                    <Btn key={f} label={f} type="fn" onClick={() => applyFn(f)} />
                  ))}
                  {/* Power / roots */}
                  {["sqrt","cbrt","sq","cube","exp"].map((f,i) => (
                    <Btn key={f} label={["√","∛","x²","x³","eˣ"][i]} type="fn" onClick={() => applyFn(f)} title={f} />
                  ))}
                  {/* Misc */}
                  <Btn label="x!" type="fn" onClick={() => applyFn("fact")} title="factorial" />
                  <Btn label="|x|" type="fn" onClick={() => applyFn("abs")} />
                  <Btn label="1/x" type="fn" onClick={() => applyFn("inv")} />
                  <Btn label="⌊x⌋" type="fn" onClick={() => applyFn("floor")} />
                  <Btn label="⌈x⌉" type="fn" onClick={() => applyFn("ceil")} />
                  {/* Constants */}
                  <Btn label="π" type="const" onClick={() => appendToExpr(String(Math.PI))} />
                  <Btn label="e" type="const" onClick={() => appendToExpr(String(Math.E))} />
                  <Btn label="xʸ" type="fn" onClick={() => appendToExpr("^")} />
                  {/* Perm / Comb */}
                  <Btn label="nPr" type="fn" onClick={() => pendingOp ? finishTwoOp() : startTwoOp("P")}
                    title={pendingOp === "P" ? "Enter r then press nPr again" : "Permutations: enter n, press nPr, enter r, press nPr"} />
                  <Btn label="nCr" type="fn" onClick={() => pendingOp ? finishTwoOp() : startTwoOp("C")}
                    title={pendingOp === "C" ? "Enter r then press nCr again" : "Combinations: enter n, press nCr, enter r, press nCr"} />
                </div>
                {/* Bracket row */}
                <div style={{ ...styles.grid(4), paddingTop: "0", paddingBottom: "4px", gap: "6px" }}>
                  <Btn label="(" type="fn" onClick={() => appendToExpr("(")} />
                  <Btn label=")" type="fn" onClick={() => appendToExpr(")")} />
                  <Btn label="%" type="fn" onClick={() => appendToExpr("%")} />
                  <Btn label="±" type="fn" onClick={() => {
                    setDisplay((d) => d.startsWith("-") ? d.slice(1) : "-" + d);
                    setExpr((e) => e.startsWith("-") ? e.slice(1) : "-" + e);
                  }} />
                </div>
              </>
            )}

            {/* Main numpad */}
            <div style={styles.grid(4)}>
              {/* Row 1 */}
              <Btn label="MC" type="mem" onClick={() => setMemory(0)} />
              <Btn label="MR" type="mem" onClick={() => { setDisplay(fmt(memory)); setExpr(fmt(memory)); }} />
              <Btn label="M+" type="mem" onClick={() => setMemory((m) => m + parseFloat(display))} />
              <Btn label="M−" type="mem" onClick={() => setMemory((m) => m - parseFloat(display))} />
              {/* Row 2 */}
              <Btn label="AC" type="clear" onClick={clearAll} />
              <Btn label="⌫" type="clear" onClick={clearEntry} />
              {mode === "basic" && <Btn label="%" type="op" onClick={() => appendToExpr("%")} />}
              {mode === "basic" && <Btn label="±" type="op" onClick={() => { setDisplay((d) => d.startsWith("-") ? d.slice(1) : "-" + d); setExpr((e) => e.startsWith("-") ? e.slice(1) : "-" + e); }} />}
              {mode === "sci" && <Btn label="," type="fn" onClick={() => appendToExpr(",")} />}
              {mode === "sci" && <Btn label="EE" type="fn" onClick={() => appendToExpr("e")} title="Scientific notation" />}
              <Btn label="÷" type="op" onClick={() => appendToExpr("/")} />
              {/* Row 3 */}
              <Btn label="7" onClick={() => appendToExpr("7")} />
              <Btn label="8" onClick={() => appendToExpr("8")} />
              <Btn label="9" onClick={() => appendToExpr("9")} />
              <Btn label="×" type="op" onClick={() => appendToExpr("*")} />
              {/* Row 4 */}
              <Btn label="4" onClick={() => appendToExpr("4")} />
              <Btn label="5" onClick={() => appendToExpr("5")} />
              <Btn label="6" onClick={() => appendToExpr("6")} />
              <Btn label="−" type="op" onClick={() => appendToExpr("-")} />
              {/* Row 5 */}
              <Btn label="1" onClick={() => appendToExpr("1")} />
              <Btn label="2" onClick={() => appendToExpr("2")} />
              <Btn label="3" onClick={() => appendToExpr("3")} />
              <Btn label="+" type="op" onClick={() => appendToExpr("+")} />
              {/* Row 6 */}
              <Btn label="0" span={2} onClick={() => appendToExpr("0")} />
              <Btn label="." onClick={() => appendToExpr(".")} />
              <Btn label="=" type="eq" onClick={pendingOp ? finishTwoOp : compute} />
            </div>
          </>
        )}

        {/* ── MATRIX ── */}
        {mode === "matrix" && (
          <div style={{ padding: "16px 20px 20px" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Size:</span>
              {[2, 3, 4].map((s) => (
                <button key={s} style={styles.modeBtn(matSize === s)} onClick={() => setMatSize(s)}>
                  {s}×{s}
                </button>
              ))}
            </div>

            {/* Matrix inputs */}
            {["A", "B"].map((name, idx) => {
              const src = idx === 0 ? matA : matB;
              const setter = idx === 0 ? setMatA : setMatB;
              return (
                <div key={name} style={{ marginBottom: "16px" }}>
                  <div style={{ ...styles.sectionTitle, padding: "0 0 8px", fontSize: "11px", color: "#a5b4fc" }}>
                    Matrix {name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${matSize}, 1fr)`, gap: "6px" }}>
                    {Array.from({ length: matSize }, (_, i) =>
                      Array.from({ length: matSize }, (_, j) => (
                        <input
                          key={`${i}-${j}`}
                          type="number"
                          style={styles.matCell}
                          value={src[i][j]}
                          onChange={(e) => updateCell(setter, i, j, e.target.value)}
                          placeholder="0"
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Operation selector */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
              {[
                ["mul", "A × B"], ["add", "A + B"], ["sub", "A − B"],
                ["detA", "det(A)"], ["detB", "det(B)"],
                ["invA", "A⁻¹"], ["invB", "B⁻¹"],
                ["transA", "Aᵀ"], ["transB", "Bᵀ"],
              ].map(([op, lbl]) => (
                <button key={op} style={styles.modeBtn(matOp === op)} onClick={() => setMatOp(op)}>
                  {lbl}
                </button>
              ))}
            </div>

            <button
              style={{
                ...styles.btn("eq"),
                width: "100%",
                height: "44px",
                fontSize: "14px",
              }}
              onClick={computeMatrix}
            >
              Compute
            </button>

            {matResult && (
              <div style={{ ...styles.resultBox, marginTop: "16px", marginLeft: 0, marginRight: 0 }}>
                <div style={{ color: "#6ee7b7", fontWeight: "700", marginBottom: "8px", fontSize: "11px" }}>
                  Result: {typeof matResult === "string" ? matResult : matResult.label}
                </div>
                {typeof matResult !== "string" && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${matResult.data[0].length}, 1fr)`, gap: "4px" }}>
                    {matResult.data.map((row, i) =>
                      row.map((val, j) => (
                        <div key={`${i}-${j}`} style={{
                          background: "rgba(0,0,0,0.3)", borderRadius: "6px",
                          padding: "6px", textAlign: "center", color: "#e0e7ff", fontSize: "12px"
                        }}>
                          {parseFloat(val.toPrecision(6))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STATISTICS ── */}
        {mode === "stat" && (
          <div style={{ padding: "16px 20px 20px" }}>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ ...styles.sectionTitle, padding: "0 0 8px" }}>
                Enter numbers (comma-separated)
              </div>
              <textarea
                style={{ ...styles.input, height: "80px", resize: "vertical", lineHeight: "1.5" }}
                value={statInput}
                onChange={(e) => setStatInput(e.target.value)}
                placeholder="e.g. 4, 7, 13, 2, 9, 11, 6"
              />
            </div>

            <button
              style={{ ...styles.btn("eq"), width: "100%", height: "44px", fontSize: "14px" }}
              onClick={computeStats}
            >
              Calculate
            </button>

            {statResult && (
              <div style={{ ...styles.resultBox, marginTop: "16px", marginLeft: 0, marginRight: 0 }}>
                {typeof statResult === "string" ? (
                  <span>{statResult}</span>
                ) : (
                  Object.entries({
                    "Count (n)": statResult.n,
                    "Sum": statResult.sum,
                    "Mean (x̄)": statResult.mean.toFixed(6),
                    "Median": statResult.median,
                    "Mode": statResult.mode.join(", "),
                    "Minimum": statResult.min,
                    "Maximum": statResult.max,
                    "Range": statResult.range,
                    "Std Dev (σ)": statResult.stddev.toFixed(6),
                    "Variance (σ²)": statResult.variance.toFixed(6),
                  }).map(([k, v]) => (
                    <div key={k} style={styles.statRow}>
                      <span style={{ color: "rgba(255,255,255,0.45)" }}>{k}</span>
                      <span style={{ color: "#e0e7ff", fontWeight: "600" }}>{v}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quick Perm/Comb panel */}
            <div style={{ marginTop: "16px" }}>
              <div style={{ ...styles.sectionTitle, padding: "0 0 8px" }}>
                Permutations & Combinations
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                {["n", "r"].map((lbl) => {
                  const [pcN, setPcN] = useState("");
                  const [pcR, setPcR] = useState("");
                  return null; // handled below
                })}
              </div>
              <PermCombWidget />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Standalone Perm/Comb widget
function PermCombWidget() {
  const [n, setN] = useState("");
  const [r, setR] = useState("");
  const [result, setResult] = useState(null);

  function factorial(k) {
    if (k < 0 || !Number.isInteger(Number(k))) return NaN;
    if (k > 170) return Infinity;
    let f = 1; for (let i = 2; i <= k; i++) f *= i; return f;
  }

  const compute = (type) => {
    const nv = parseInt(n), rv = parseInt(r);
    if (isNaN(nv) || isNaN(rv)) { setResult("Enter valid integers"); return; }
    if (rv > nv) { setResult("r must be ≤ n"); return; }
    const P = factorial(nv) / factorial(nv - rv);
    const C = factorial(nv) / (factorial(rv) * factorial(nv - rv));
    setResult({ P: isFinite(P) ? P : "∞", C: isFinite(C) ? C : "∞" });
  };

  const inp = {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#e0e7ff",
    fontFamily: "inherit",
    fontSize: "13px",
    padding: "8px 10px",
    boxSizing: "border-box",
    outline: "none",
    width: "100%",
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", marginBottom: "4px" }}>n</div>
          <input type="number" style={inp} value={n} onChange={(e) => setN(e.target.value)} placeholder="n" />
        </div>
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", marginBottom: "4px" }}>r</div>
          <input type="number" style={inp} value={r} onChange={(e) => setR(e.target.value)} placeholder="r" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <button
          style={{
            background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "10px", color: "#a5b4fc", fontFamily: "inherit",
            fontSize: "12px", padding: "8px", cursor: "pointer"
          }}
          onClick={() => compute("P")}
        >nPr &amp; nCr</button>
        <button
          style={{
            background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: "10px", color: "#6ee7b7", fontFamily: "inherit",
            fontSize: "12px", padding: "8px", cursor: "pointer"
          }}
          onClick={() => { setN(""); setR(""); setResult(null); }}
        >Clear</button>
      </div>
      {result && (
        <div style={{
          marginTop: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "10px",
          padding: "10px 12px", fontSize: "12px"
        }}>
          {typeof result === "string" ? (
            <span style={{ color: "#fca5a5" }}>{result}</span>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>P({n},{r}) =</span>
                <span style={{ color: "#e0e7ff", fontWeight: "700" }}>{result.P}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>C({n},{r}) =</span>
                <span style={{ color: "#e0e7ff", fontWeight: "700" }}>{result.C}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
