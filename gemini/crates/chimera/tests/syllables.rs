//! Port of tests/syllables.test.ts.
use chimera::phonetics::Segment;
use chimera::phonetics::english::arpabet_to_segments;
use chimera::phonetics::syllables::{lyrics_to_syllables, split_spelling, syllabify_segments};

// a few CMUdict entries, enough to test without loading the dictionary
fn dict(w: &str) -> Option<&'static str> {
    Some(match w {
        "twinkle" => "T W IH1 NG K AH0 L",
        "little" => "L IH1 T AH0 L",
        "star" => "S T AA1 R",
        "how" => "HH AW1",
        "i" => "AY1",
        "wonder" => "W AH1 N D ER0",
        "what" => "W AH1 T",
        "you" => "Y UW1",
        "are" => "AA1 R",
        "extra" => "EH1 K S T R AH0",
        "of" => "AH1 V",
        _ => return None,
    })
}
fn word(w: &str, _reduce: bool) -> Vec<Segment> {
    dict(w).map(arpabet_to_segments).unwrap_or_default()
}
fn ipa(xs: &[Segment]) -> String {
    xs.iter().map(|x| x.ipa.as_str()).collect()
}

#[test]
fn maximal_onset_with_legal_english_clusters() {
    let tw = syllabify_segments(&word("twinkle", false));
    let got: Vec<[String; 3]> = tw.iter().map(|s| [ipa(&s.onset), s.nucleus.ipa.clone(), ipa(&s.coda)]).collect();
    assert_eq!(got, [["tw", "ɪ", "ŋ"].map(String::from), ["k", "ə", "l"].map(String::from)]);
    // "extra": k + str → ek-stra (str is a legal onset)
    let ex = syllabify_segments(&word("extra", false));
    assert_eq!(ex.iter().map(|s| ipa(&s.onset)).collect::<Vec<_>>(), ["", "stɹ"]);
    assert_eq!(ipa(&ex[0].coda), "k");
}

#[test]
fn spelling_splits_to_match() {
    assert_eq!(split_spelling("twinkle", 2), ["twin", "kle"]);
    assert_eq!(split_spelling("little", 2), ["lit", "tle"]);
    assert_eq!(split_spelling("wonder", 2), ["won", "der"]);
    assert_eq!(split_spelling("are", 1), ["are"]);
}

#[test]
fn lyrics_words_melisma_phrase_ends_unreduced_function_words() {
    let syl = lyrics_to_syllables("Twinkle little star, how I - wonder", &word);
    assert_eq!(syl.iter().map(|s| s.text.as_str()).collect::<Vec<_>>(), ["Twin", "kle", "lit", "tle", "star", "how", "I", "~", "won", "der"]);
    assert!(syl[4].phrase_end);
    assert_eq!(syl[7].melisma, Some(true));
    assert_eq!(syl[7].nucleus.ipa, "aɪ");
    assert!(syl[1].word_end && !syl[0].word_end);
}

#[test]
fn mandarin_hanzi_and_pinyin_syllabify_cleanly() {
    let g2p = chimera::phonetics::english::EnglishG2P::new();
    let syl = lyrics_to_syllables("没什么大愿 - 望，", &g2p);
    assert_eq!(syl.len(), 7);
    assert_eq!(syl[0].text, "没 mei");
    assert_eq!(syl[0].nucleus.ipa, "eɪ");
    assert_eq!(syl[4].text, "愿 yuan");
    assert_eq!(syl[5].melisma, Some(true));
    assert_eq!(syl[6].text, "望 wang");
    assert!(syl[6].phrase_end);

    // Every pitched note in the Xiao Mei Man demo song matches a syllable or melisma 1-to-1
    let song = &chimera::phonetics::songs::DEMO_SONGS[0];
    let all_syls = lyrics_to_syllables(song.lyrics, &g2p);
    let pitched_count = song.notes.iter().filter(|n| n[0] > 0.0).count();
    assert_eq!(all_syls.len(), pitched_count);
}
