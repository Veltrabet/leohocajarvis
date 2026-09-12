import { Globe } from "lucide-react";
import { LANG_META, useLang, type Lang } from "@/lib/lang";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ORDER: Lang[] = ["auto", "tr", "sq", "en"];

export default function LangSwitch() {
  const [lang, set] = useLang();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="lang-switch"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#00F0FF]/25 px-2.5 font-mono text-[11px] tracking-widest text-[#00F0FF] transition-colors duration-200 hover:bg-[#00F0FF]/10"
        aria-label="Dil seçimi"
      >
        <Globe className="h-3.5 w-3.5" />
        {LANG_META[lang].short}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {ORDER.map((l) => (
          <DropdownMenuItem
            key={l}
            data-testid={`lang-option-${l}`}
            onClick={() => set(l)}
            className="font-mono text-xs tracking-wide"
          >
            {LANG_META[l].short} · {LANG_META[l].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
