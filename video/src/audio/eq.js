// Minimal RBJ biquads for the master chain.
export function makeBiquad(type, f0, gainDb, Q, sr = 48000) {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * f0) / sr;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const alpha = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lowshelf') {
    const s = 2 * Math.sqrt(A) * alpha;
    b0 = A * (A + 1 - (A - 1) * cw + s);
    b1 = 2 * A * (A - 1 - (A + 1) * cw);
    b2 = A * (A + 1 - (A - 1) * cw - s);
    a0 = A + 1 + (A - 1) * cw + s;
    a1 = -2 * (A - 1 + (A + 1) * cw);
    a2 = A + 1 + (A - 1) * cw - s;
  } else if (type === 'highshelf') {
    const s = 2 * Math.sqrt(A) * alpha;
    b0 = A * (A + 1 + (A - 1) * cw + s);
    b1 = -2 * A * (A - 1 + (A + 1) * cw);
    b2 = A * (A + 1 + (A - 1) * cw - s);
    a0 = A + 1 - (A - 1) * cw + s;
    a1 = 2 * (A - 1 - (A + 1) * cw);
    a2 = A + 1 - (A - 1) * cw - s;
  } else {
    // peaking
    b0 = 1 + alpha * A;
    b1 = -2 * cw;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cw;
    a2 = 1 - alpha / A;
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

export function masterChain(sr = 48000) {
  const lowCut = makeBiquad('lowshelf', 130, -3.2, 0.7, sr);
  const presence = makeBiquad('peaking', 3200, 2.6, 0.9, sr);
  const air = makeBiquad('highshelf', 9000, 1.6, 0.7, sr);
  const lowCut2 = makeBiquad('lowshelf', 130, -3.2, 0.7, sr);
  const presence2 = makeBiquad('peaking', 3200, 2.6, 0.9, sr);
  const air2 = makeBiquad('highshelf', 9000, 1.6, 0.7, sr);
  return (x, ch) => {
    const f = ch === 0 ? [lowCut, presence, air] : [lowCut2, presence2, air2];
    let v = x;
    for (const s of f) v = s(v);
    return v;
  };
}
