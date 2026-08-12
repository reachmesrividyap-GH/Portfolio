import { ScrapedItem } from '@/types/database';

export interface FirecrawlResponse {
  items: ScrapedItem[];
}

export async function scrapeWebsite(url: string): Promise<FirecrawlResponse> {
  const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('Firecrawl API key is not configured. Please add VITE_FIRECRAWL_API_KEY to your .env file.');
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(`Firecrawl API error: ${errorBody?.error || response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error('Firecrawl scraping failed');
    }

    const items: ScrapedItem[] = [];
    const content = data.data?.markdown || '';

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('# ')) {
        items.push({ type: 'heading', text: trimmedLine.replace(/^# /, ''), level: 1 });
      } else if (trimmedLine.startsWith('## ')) {
        items.push({ type: 'heading', text: trimmedLine.replace(/^## /, ''), level: 2 });
      } else if (trimmedLine.startsWith('### ')) {
        items.push({ type: 'heading', text: trimmedLine.replace(/^### /, ''), level: 3 });
      } else if (trimmedLine.match(/^\[.*?\]\(.*?\)$/)) {
        const match = trimmedLine.match(/^\[(.*?)\]\((.*?)\)$/);
        if (match) {
          items.push({ type: 'link', text: match[1], url: match[2] });
        }
      }
    }

    if (data.data?.metadata?.title) {
      items.unshift({ type: 'title', text: data.data.metadata.title });
    }

    return { items };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Website scraping failed: ${error.message}`);
    }
    throw new Error('Website scraping failed with unknown error');
  }
}
