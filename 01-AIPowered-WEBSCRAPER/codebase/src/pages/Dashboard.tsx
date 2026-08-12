import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Sun, Moon, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Board } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { NeonOrbs } from '@/components/ui/neon-orbs';
import { scrapeWebsite } from '@/services/firecrawl';
import { ScrapedItem } from '@/types/database';

export function Dashboard() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBoardName, setNewBoardName] = useState('');
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapedItems, setScrapedItems] = useState<ScrapedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showCreateTasks, setShowCreateTasks] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadBoards();
  }, [user, navigate]);

  const loadBoards = async () => {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBoards(data || []);
    } catch (error) {
      console.error('Error loading boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('boards')
        .insert([{ name: newBoardName, user_id: user?.id }])
        .select()
        .single();

      if (error) throw error;

      const { error: columnsError } = await supabase
        .from('columns')
        .insert([
          { board_id: data.id, name: 'To-Do', position: 0 },
          { board_id: data.id, name: 'In Progress', position: 1 },
          { board_id: data.id, name: 'Done', position: 2 },
        ]);

      if (columnsError) throw columnsError;

      setBoards([data, ...boards]);
      setNewBoardName('');
      setShowNewBoard(false);
    } catch (error) {
      console.error('Error creating board:', error);
    }
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;

    setScraping(true);
    try {
      const result = await scrapeWebsite(scrapeUrl);
      setScrapedItems(result.items);
      setSelectedItems(new Set());
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Scraping failed');
    } finally {
      setScraping(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NeonOrbs />
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <NeonOrbs />
      <div className="relative z-10">
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">Scrape Board</h1>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">
                AI-Powered Web Content Analyzer &amp; Management Tool
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-2xl">
                Scrape any website into structured content and convert it into tasks with one
                click, or add your own manually. Organize everything on Kanban boards with
                AI-powered subtask breakdowns.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Your Boards</h2>
                <Button onClick={() => setShowNewBoard(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Board
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {boards.map((board) => (
                  <Card
                    key={board.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => navigate(`/board/${board.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{board.name}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {boards.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500 mb-4">No boards yet</p>
                    <Button onClick={() => setShowNewBoard(true)}>Create Your First Board</Button>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Website Scraper
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="https://example.com"
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                    />
                    <Button className="w-full" onClick={handleScrape} disabled={scraping}>
                      {scraping ? 'Scraping...' : 'Scrape Website'}
                    </Button>
                  </div>

                  {scrapedItems.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Scraped Items ({scrapedItems.length})</p>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {scrapedItems.map((item, index) => (
                          <div
                            key={index}
                            className={`p-2 rounded border cursor-pointer transition-colors ${
                              selectedItems.has(index)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                : 'border-gray-200 dark:border-gray-800'
                            }`}
                            onClick={() => toggleItemSelection(index)}
                          >
                            <p className="text-sm font-medium">{item.text}</p>
                            <p className="text-xs text-gray-500">{item.type}</p>
                          </div>
                        ))}
                      </div>
                      <Button
                        className="w-full"
                        disabled={selectedItems.size === 0}
                        onClick={() => setShowCreateTasks(true)}
                      >
                        Add {selectedItems.size} as Tasks
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Board name"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createBoard()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBoard(false)}>
              Cancel
            </Button>
            <Button onClick={createBoard}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTasks} onOpenChange={setShowCreateTasks}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select a Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {boards.map((board) => (
              <Button
                key={board.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  navigate(`/board/${board.id}`, {
                    state: {
                      createTasks: Array.from(selectedItems).map((i) => scrapedItems[i]),
                    },
                  });
                }}
              >
                {board.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
