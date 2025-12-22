'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Button } from '@/lib/components/ui/button';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { apiGet } from '@/lib/utils/api-client';
import Link from 'next/link';

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  link: string;
}

interface HelpIntegrationProps {
  conversationSubject?: string;
  onStartConversation?: () => void;
}

export function HelpIntegration({
  conversationSubject,
  onStartConversation,
}: HelpIntegrationProps) {
  const [helpArticles, setHelpArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversationSubject) {
      searchHelp(conversationSubject);
    }
  }, [conversationSubject]);

  const searchHelp = async (query: string) => {
    setLoading(true);
    try {
      const data = await apiGet<{ results: HelpArticle[] }>(
        `/api/help/search?q=${encodeURIComponent(query)}`,
      );
      setHelpArticles(data.results || []);
    } catch (error) {
      console.error('Failed to search help:', error);
    } finally {
      setLoading(false);
    }
  };

  if (helpArticles.length === 0 && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/help">
              <HelpCircle className="h-4 w-4 mr-2" />
              Visit Help Center
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          Related Help Articles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">Searching...</p>
        ) : (
          helpArticles.slice(0, 3).map((article) => (
            <Link key={article.id} href={article.link}>
              <div className="p-2 rounded border hover:bg-accent transition-colors">
                <p className="text-xs font-semibold">{article.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{article.description}</p>
              </div>
            </Link>
          ))
        )}
        <Button variant="outline" size="sm" asChild className="w-full mt-2">
          <Link href="/help">
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Help
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
