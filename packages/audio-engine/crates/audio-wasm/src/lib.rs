use std::slice;

/// Computes 3-band peak envelopes (low: <250Hz, mid: 250Hz-2000Hz, high: >2000Hz)
/// directly in WebAssembly for fast off-thread waveform analysis.
///
/// Returns the number of buckets processed.
#[no_mangle]
pub unsafe extern "C" fn compute_3band_peaks(
    data_ptr: *const f32,
    data_len: usize,
    sample_rate: f32,
    s0: usize,
    e0: usize,
    n_buckets: usize,
    out_low: *mut u8,
    out_mid: *mut u8,
    out_high: *mut u8,
) -> usize {
    if data_ptr.is_null() || out_low.is_null() || out_mid.is_null() || out_high.is_null() {
        return 0;
    }
    if s0 >= e0 || e0 > data_len || n_buckets == 0 {
        return 0;
    }

    let data = slice::from_raw_parts(data_ptr, data_len);
    let low_slice = slice::from_raw_parts_mut(out_low, n_buckets);
    let mid_slice = slice::from_raw_parts_mut(out_mid, n_buckets);
    let high_slice = slice::from_raw_parts_mut(out_high, n_buckets);

    let bucket = 1.max((e0 - s0) / n_buckets);
    let a_low = 1.0 - (-2.0 * std::f32::consts::PI * 250.0 / sample_rate).exp();
    let a_mid = 1.0 - (-2.0 * std::f32::consts::PI * 2000.0 / sample_rate).exp();

    let mut lp_low = 0.0f32;
    let mut lp_mid = 0.0f32;

    let mut raw_low = vec![0.0f32; n_buckets];
    let mut raw_mid = vec![0.0f32; n_buckets];
    let mut raw_high = vec![0.0f32; n_buckets];

    let mut top_low = 0.0f32;
    let mut top_mid = 0.0f32;
    let mut top_high = 0.0f32;

    for i in 0..n_buckets {
        let bs = s0 + i * bucket;
        let be = (bs + bucket).min(e0);
        let mut max_low = 0.0f32;
        let mut max_mid = 0.0f32;
        let mut max_high = 0.0f32;

        for &x in &data[bs..be] {
            lp_low += a_low * (x - lp_low);
            lp_mid += a_mid * (x - lp_mid);
            let a_l = lp_low.abs();
            let a_m = (lp_mid - lp_low).abs();
            let a_h = (x - lp_mid).abs();
            if a_l > max_low { max_low = a_l; }
            if a_m > max_mid { max_mid = a_m; }
            if a_h > max_high { max_high = a_h; }
        }

        raw_low[i] = max_low;
        raw_mid[i] = max_mid;
        raw_high[i] = max_high;

        if max_low > top_low { top_low = max_low; }
        if max_mid > top_mid { top_mid = max_mid; }
        if max_high > top_high { top_high = max_high; }
    }

    for i in 0..n_buckets {
        low_slice[i] = if top_low > 0.0 { ((raw_low[i] / top_low) * 100.0).round() as u8 } else { 0 };
        mid_slice[i] = if top_mid > 0.0 { ((raw_mid[i] / top_mid) * 100.0).round() as u8 } else { 0 };
        high_slice[i] = if top_high > 0.0 { ((raw_high[i] / top_high) * 100.0).round() as u8 } else { 0 };
    }

    n_buckets
}

/// Allocates memory buffer inside WebAssembly module instance for zero-copy transfers.
#[no_mangle]
pub extern "C" fn alloc_f32_buffer(size: usize) -> *mut f32 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn free_f32_buffer(ptr: *mut f32, size: usize) {
    if !ptr.is_null() {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[no_mangle]
pub extern "C" fn alloc_u8_buffer(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn free_u8_buffer(ptr: *mut u8, size: usize) {
    if !ptr.is_null() {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_peaks() {
        let sample_rate = 44100.0;
        let data = vec![0.5f32, -0.5, 0.8, -0.8, 0.1, -0.1];
        let mut out_low = vec![0u8; 2];
        let mut out_mid = vec![0u8; 2];
        let mut out_high = vec![0u8; 2];

        unsafe {
            let res = compute_3band_peaks(
                data.as_ptr(),
                data.len(),
                sample_rate,
                0,
                data.len(),
                2,
                out_low.as_mut_ptr(),
                out_mid.as_mut_ptr(),
                out_high.as_mut_ptr(),
            );
            assert_eq!(res, 2);
        }
    }
}
