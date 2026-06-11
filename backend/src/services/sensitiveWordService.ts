import { PrismaClient, SensitiveWordLevel } from '@prisma/client';

const prisma = new PrismaClient();

interface TrieNode {
    children: Map<string, TrieNode>;
    isEnd: boolean;
    level?: SensitiveWordLevel;
    word?: string;
}

interface MatchResult {
    word: string;
    level: SensitiveWordLevel;
    start: number;
    end: number;
}

interface FilterResult {
    allowed: boolean;
    filteredContent: string;
    action: 'ALLOW' | 'BLOCK' | 'REPLACE' | 'REVIEW';
    matchedWords: MatchResult[];
    reviewRequired: boolean;
}

const NOISE_CHARS = /[\s\u3000\u00a0\.\,\，\。\!\！\?\？\;\；\:\：\＂\＃\＄\％\＆\＇\（\）\＊\＋\，\－\．\／\０-９\：\；\＜\＝\＞\？\＠\Ａ-Ｚ\［\］\＾\＿\｀\ａ-ｚ\｛\｜\｝\～\｀\！\＠\＃\＄\％\＾\＆\＊\（\）\－\＿\＝\＋\[\]\\\{\}\|\;\'\:\"\,\.\/\<\>\?\`\~]/g;

class SensitiveWordFilter {
    private root: TrieNode;
    private initialized: boolean;

    constructor() {
        this.root = this.createNode();
        this.initialized = false;
    }

    private createNode(): TrieNode {
        return {
            children: new Map(),
            isEnd: false
        };
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    private normalize(text: string): string {
        return text
            .toLowerCase()
            .replace(NOISE_CHARS, '')
            .replace(/\s+/g, '');
    }

    async init(): Promise<void> {
        this.root = this.createNode();
        const words = await prisma.sensitiveWord.findMany({
            where: { isActive: true }
        });
        for (const w of words) {
            this.addWord(w.word, w.level);
        }
        this.initialized = true;
        console.log(`Sensitive word filter initialized with ${words.length} words`);
    }

    async refresh(): Promise<void> {
        await this.init();
    }

    addWord(word: string, level: SensitiveWordLevel): void {
        const normalized = this.normalize(word);
        if (!normalized) return;
        let node = this.root;
        for (const char of normalized) {
            if (!node.children.has(char)) {
                node.children.set(char, this.createNode());
            }
            node = node.children.get(char)!;
        }
        node.isEnd = true;
        node.level = level;
        node.word = word;
    }

    removeWord(word: string): void {
        const normalized = this.normalize(word);
        if (!normalized) return;
        this._remove(this.root, normalized, 0);
    }

    private _remove(node: TrieNode, word: string, index: number): boolean {
        if (index === word.length) {
            if (!node.isEnd) return false;
            node.isEnd = false;
            delete node.level;
            delete node.word;
            return node.children.size === 0;
        }
        const char = word[index];
        const child = node.children.get(char);
        if (!child) return false;
        const shouldDeleteChild = this._remove(child, word, index + 1);
        if (shouldDeleteChild) {
            node.children.delete(char);
            return node.children.size === 0 && !node.isEnd;
        }
        return false;
    }

    match(content: string): MatchResult[] {
        const matches: MatchResult[] = [];
        const normalized = this.normalize(content);
        if (!normalized) return matches;
        const n = normalized.length;
        for (let i = 0; i < n; i++) {
            let node = this.root;
            let j = i;
            let longestEnd = -1;
            let longestLevel: SensitiveWordLevel | undefined;
            let longestWord: string | undefined;
            while (j < n && node.children.has(normalized[j])) {
                node = node.children.get(normalized[j])!;
                j++;
                if (node.isEnd) {
                    longestEnd = j;
                    longestLevel = node.level;
                    longestWord = node.word;
                }
            }
            if (longestEnd !== -1 && longestLevel && longestWord) {
                matches.push({
                    word: longestWord,
                    level: longestLevel,
                    start: i,
                    end: longestEnd
                });
                i = longestEnd - 1;
            }
        }
        return this.mergeMatches(matches);
    }

    private mergeMatches(matches: MatchResult[]): MatchResult[] {
        if (matches.length <= 1) return matches;
        const sorted = [...matches].sort((a, b) => a.start - b.start);
        const merged: MatchResult[] = [];
        let prev = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
            const curr = sorted[i];
            if (curr.start < prev.end) {
                if (prev.level === 'BAN' || curr.level === 'BAN') {
                    prev.level = 'BAN';
                } else if (prev.level === 'REVIEW' || curr.level === 'REVIEW') {
                    prev.level = 'REVIEW';
                }
                prev.word = prev.word + ',' + curr.word;
                prev.end = Math.max(prev.end, curr.end);
            } else {
                merged.push(prev);
                prev = curr;
            }
        }
        merged.push(prev);
        return merged;
    }

    filter(content: string): FilterResult {
        const matches = this.match(content);
        if (matches.length === 0) {
            return {
                allowed: true,
                filteredContent: content,
                action: 'ALLOW',
                matchedWords: [],
                reviewRequired: false
            };
        }
        const hasBan = matches.some(m => m.level === 'BAN');
        if (hasBan) {
            return {
                allowed: false,
                filteredContent: content,
                action: 'BLOCK',
                matchedWords: matches,
                reviewRequired: false
            };
        }
        const hasReview = matches.some(m => m.level === 'REVIEW');
        let filtered = content;
        const replaceMatches = matches.filter(m => m.level === 'REPLACE');
        if (replaceMatches.length > 0) {
            const normalized = this.normalize(content);
            const charMap = this.buildCharMap(content);
            for (const m of replaceMatches) {
                const origStart = charMap[m.start];
                const origEnd = charMap[m.end - 1] + 1;
                const length = origEnd - origStart;
                const replacement = '*'.repeat(length);
                filtered = filtered.substring(0, origStart) + replacement + filtered.substring(origEnd);
            }
        }
        if (hasReview) {
            return {
                allowed: true,
                filteredContent: filtered,
                action: 'REVIEW',
                matchedWords: matches,
                reviewRequired: true
            };
        }
        return {
            allowed: true,
            filteredContent: filtered,
            action: 'REPLACE',
            matchedWords: replaceMatches,
            reviewRequired: false
        };
    }

    private buildCharMap(original: string): number[] {
        const map: number[] = [];
        const len = original.length;
        let j = 0;
        for (let i = 0; i < len; i++) {
            const ch = original[i];
            const test = ch.toLowerCase().replace(NOISE_CHARS, '');
            if (test && test.length > 0) {
                map[j] = i;
                j++;
            }
        }
        return map;
    }
}

export const sensitiveWordFilter = new SensitiveWordFilter();

export const initSensitiveWordFilter = async () => {
    await sensitiveWordFilter.init();
};

export const refreshSensitiveWordFilter = async () => {
    await sensitiveWordFilter.refresh();
};

export const filterContent = (content: string): FilterResult => {
    if (!sensitiveWordFilter.isInitialized()) {
        return {
            allowed: true,
            filteredContent: content,
            action: 'ALLOW',
            matchedWords: [],
            reviewRequired: false
        };
    }
    return sensitiveWordFilter.filter(content);
};
