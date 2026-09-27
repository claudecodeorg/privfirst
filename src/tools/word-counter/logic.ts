export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
  speakingMinutes: number;
}

const READING_WPM = 200;
const SPEAKING_WPM = 130;

export function countStats(text: string): TextStats {
  const words = text.trim() === '' ? 0 : (text.trim().match(/\S+/g) ?? []).length;
  const sentences = text.trim() === '' ? 0 : (text.match(/[^.!?]*[.!?]+|[^.!?]+$/g)?.filter((s) => s.trim()).length ?? 0);
  const paragraphs = text.trim() === '' ? 0 : text.split(/\n{2,}|\r\n{2,}/).filter((p) => p.trim()).length;
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words,
    sentences,
    paragraphs,
    readingMinutes: words / READING_WPM,
    speakingMinutes: words / SPEAKING_WPM,
  };
}
