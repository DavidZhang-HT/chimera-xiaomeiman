//! How the human voice's source settings shape the glottis.
use chimera::voice::human_voice::{HumanVoice, SourcePatch};

#[test]
fn pitch_replacement_reaches_an_active_score_and_bypasses_without_restarting_it() {
    use chimera::control::score::{ControlKey, Gesture, Targets};
    let mut v = HumanVoice::with_defaults(48000.0);
    v.set_source(&SourcePatch { f0: Some(196.0), ..Default::default() });
    let mut targets = Targets::default();
    targets.set(ControlKey::F0, 196.0);
    targets.set(ControlKey::BREATH, 1.0);
    v.schedule(&[Gesture::new(0.0, 4.0, 0.02, 0.02, 1.0, targets)]);
    let mut out = vec![0.0; 24000];
    v.render(&mut out);
    let before = v.glottis.params.f0;
    // JSON exercises backward-compatible source parsing as well as the live control path.
    let replacement: SourcePatch = serde_json::from_str(r#"{"pitchShiftSemitones":7}"#).unwrap();
    v.set_source(&replacement);
    v.render(&mut out);
    assert!((v.glottis.params.f0 / before - 2.0_f64.powf(7.0 / 12.0)).abs() < 0.001,
        "active score swallowed the pitch replacement: {} -> {}", before, v.glottis.params.f0);
    assert!(out.iter().all(|x| x.is_finite() && x.abs() <= 1.0));
    let bypass: SourcePatch = serde_json::from_str(r#"{"pitchShiftSemitones":0}"#).unwrap();
    v.set_source(&bypass);
    v.render(&mut out);
    assert!((v.glottis.params.f0 - before).abs() < 0.1);
    assert!(v.score.size() > 0);
}

#[test]
fn a_pressed_voice_still_closes_abruptly() {
    // a sung or spoken voice closes softly (tension 0.5-0.55), but the "Pressed" control's top end
    // keeps the abrupt closure of a pressed voice, and the closure sharpens with tension throughout
    let mut v = HumanVoice::with_defaults(48000.0);
    let mut sharpness = |tension: f64| {
        v.set_source(&SourcePatch { tension: Some(tension), ..Default::default() });
        v.glottis.params.closure_sharpness
    };
    assert!(sharpness(0.55) < 0.25);
    assert!(sharpness(1.0) > 0.9);
    let mut last = -1.0;
    for i in 0..=20 {
        let t = i as f64 / 20.0;
        let s = sharpness(t);
        assert!(s > last, "closure sharpness falls at tension {t}");
        last = s;
    }
}

#[test]
fn brightness_tilts_the_voice_and_its_default_changes_nothing() {
    // the Bright control: at its default the closure is what tension alone gives; turned up, the
    // folds close more abruptly and the voice carries more high-frequency energy
    let mut v = HumanVoice::with_defaults(48000.0);
    v.set_source(&SourcePatch { tension: Some(0.55), ..Default::default() });
    let default = v.glottis.params.closure_sharpness;
    assert!((default - 0.22).abs() < 1e-12, "{default}");
    let mut tilt = |b: f64| {
        let mut v = HumanVoice::with_defaults(48000.0);
        v.set_source(&SourcePatch { tension: Some(0.55), brightness: Some(b), ..Default::default() });
        v.set_gate(1.0);
        let mut out = vec![0.0f32; 48000];
        for c in out.chunks_mut(128) {
            v.render(c);
        }
        // mean squared first difference over mean square: rises with the share of high frequencies
        let x = &out[24000..];
        let d: f64 = x.windows(2).map(|w| ((w[1] - w[0]) as f64).powi(2)).sum();
        let e: f64 = x.iter().map(|s| (*s as f64).powi(2)).sum();
        (v.glottis.params.closure_sharpness, 10.0 * (d / e).log10())
    };
    let (dark, mid, bright) = (tilt(0.0), tilt(0.25), tilt(1.0));
    assert_eq!(mid.0, default);
    assert!(dark.0 < mid.0 && mid.0 < bright.0);
    println!("high-frequency share (dB): dark {:.1}, default {:.1}, bright {:.1}", dark.1, mid.1, bright.1);
    // little room to darken (the default closure is already soft), a lot to brighten
    assert!(dark.1 < mid.1 && mid.1 < bright.1 - 3.0, "{dark:?} {mid:?} {bright:?}");
}
