"use client";

import { useMemo } from "react";

const CHAR_MAPS: Record<string, Record<string, { mac: string; win: string }>> = {
  French: {
    é: { mac: "⌥E → E", win: "Alt+0233" },
    è: { mac: "⌥` → E", win: "Alt+0232" },
    ê: { mac: "⌥I → E", win: "Alt+0234" },
    ë: { mac: "⌥U → E", win: "Alt+0235" },
    à: { mac: "⌥` → A", win: "Alt+0224" },
    â: { mac: "⌥I → A", win: "Alt+0226" },
    ä: { mac: "⌥U → A", win: "Alt+0228" },
    ç: { mac: "⌥C",     win: "Alt+0231" },
    ù: { mac: "⌥` → U", win: "Alt+0249" },
    û: { mac: "⌥I → U", win: "Alt+0251" },
    ü: { mac: "⌥U → U", win: "Alt+0252" },
    î: { mac: "⌥I → I", win: "Alt+0238" },
    ï: { mac: "⌥U → I", win: "Alt+0239" },
    ô: { mac: "⌥I → O", win: "Alt+0244" },
    œ: { mac: "⌥Q",     win: "Alt+0156" },
    æ: { mac: "⌥'",     win: "Alt+0230" },
    É: { mac: "⌥E → ⇧E", win: "Alt+0201" },
    È: { mac: "⌥` → ⇧E", win: "Alt+0200" },
    À: { mac: "⌥` → ⇧A", win: "Alt+0192" },
    Ç: { mac: "⌥⇧C",     win: "Alt+0199" },
    Œ: { mac: "⌥⇧Q",     win: "Alt+0140" },
  },
  Spanish: {
    á: { mac: "⌥E → A", win: "Alt+0225" },
    é: { mac: "⌥E → E", win: "Alt+0233" },
    í: { mac: "⌥E → I", win: "Alt+0237" },
    ó: { mac: "⌥E → O", win: "Alt+0243" },
    ú: { mac: "⌥E → U", win: "Alt+0250" },
    ñ: { mac: "⌥N → N", win: "Alt+0241" },
    ü: { mac: "⌥U → U", win: "Alt+0252" },
    "¡": { mac: "⌥1",   win: "Alt+0161" },
    "¿": { mac: "⌥⇧?",  win: "Alt+0191" },
    Á: { mac: "⌥E → ⇧A", win: "Alt+0193" },
    É: { mac: "⌥E → ⇧E", win: "Alt+0201" },
    Í: { mac: "⌥E → ⇧I", win: "Alt+0205" },
    Ó: { mac: "⌥E → ⇧O", win: "Alt+0211" },
    Ú: { mac: "⌥E → ⇧U", win: "Alt+0218" },
    Ñ: { mac: "⌥N → ⇧N", win: "Alt+0209" },
  },
  German: {
    ä: { mac: "⌥U → A", win: "Alt+0228" },
    ö: { mac: "⌥U → O", win: "Alt+0246" },
    ü: { mac: "⌥U → U", win: "Alt+0252" },
    ß: { mac: "⌥S",     win: "Alt+0223" },
    Ä: { mac: "⌥U → ⇧A", win: "Alt+0196" },
    Ö: { mac: "⌥U → ⇧O", win: "Alt+0214" },
    Ü: { mac: "⌥U → ⇧U", win: "Alt+0220" },
  },
  Portuguese: {
    ã: { mac: "⌥N → A", win: "Alt+0227" },
    â: { mac: "⌥I → A", win: "Alt+0226" },
    á: { mac: "⌥E → A", win: "Alt+0225" },
    à: { mac: "⌥` → A", win: "Alt+0224" },
    é: { mac: "⌥E → E", win: "Alt+0233" },
    ê: { mac: "⌥I → E", win: "Alt+0234" },
    í: { mac: "⌥E → I", win: "Alt+0237" },
    õ: { mac: "⌥N → O", win: "Alt+0245" },
    ó: { mac: "⌥E → O", win: "Alt+0243" },
    ô: { mac: "⌥I → O", win: "Alt+0244" },
    ú: { mac: "⌥E → U", win: "Alt+0250" },
    ü: { mac: "⌥U → U", win: "Alt+0252" },
    ç: { mac: "⌥C",     win: "Alt+0231" },
  },
  Italian: {
    à: { mac: "⌥` → A", win: "Alt+0224" },
    è: { mac: "⌥` → E", win: "Alt+0232" },
    é: { mac: "⌥E → E", win: "Alt+0233" },
    ì: { mac: "⌥` → I", win: "Alt+0236" },
    í: { mac: "⌥E → I", win: "Alt+0237" },
    ò: { mac: "⌥` → O", win: "Alt+0242" },
    ó: { mac: "⌥E → O", win: "Alt+0243" },
    ù: { mac: "⌥` → U", win: "Alt+0249" },
    ú: { mac: "⌥E → U", win: "Alt+0250" },
  },
};

interface Props {
  text: string;
  language: string;
}

export function PhoneticHints({ text, language }: Props) {
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return true;
    return /Mac|iPhone|iPad/.test(navigator.platform);
  }, []);

  const map = CHAR_MAPS[language] ?? {};

  const hints = useMemo(() => {
    const seen = new Set<string>();
    const result: { char: string; hint: string }[] = [];
    for (const ch of text) {
      if (!seen.has(ch) && map[ch]) {
        seen.add(ch);
        result.push({ char: ch, hint: isMac ? map[ch].mac : map[ch].win });
      }
    }
    return result;
  }, [text, map, isMac]);

  if (hints.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className="text-xs text-gray-400 self-center mr-1">键位:</span>
      {hints.map(({ char, hint }) => (
        <span
          key={char}
          className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-2 py-0.5 font-mono"
        >
          <span className="font-bold">{char}</span>
          <span className="text-amber-400">→</span>
          <span>{hint}</span>
        </span>
      ))}
    </div>
  );
}
