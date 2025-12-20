'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Badge } from '@/lib/components/ui/badge';
import { apiGet, apiPost, apiPut } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { Plus, Edit, Star, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';

interface Currency {
  _id: string;
  code: string;
  symbol: string;
  exchangeRate?: number | null;
  rateTimestamp?: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [code, setCode] = useState('');
  const [symbol, setSymbol] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  async function fetchCurrencies() {
    try {
      setIsLoading(true);
      const data = await apiGet<{ currencies: Currency[] }>('/api/settings/currencies');
      setCurrencies(data.currencies || []);
    } catch (err) {
      console.error('Failed to fetch currencies:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function openDialog(currency?: Currency) {
    if (currency) {
      setEditingCurrency(currency);
      setCode(currency.code);
      setSymbol(currency.symbol);
      setExchangeRate(currency.exchangeRate?.toString() || '');
      setIsPrimary(currency.isPrimary);
    } else {
      setEditingCurrency(null);
      setCode('');
      setSymbol('');
      setExchangeRate('');
      setIsPrimary(false);
    }
    setDialogOpen(true);
  }

  async function handleSubmit() {
    try {
      if (editingCurrency) {
        await apiPut(`/api/settings/currencies/${editingCurrency.code}`, {
          symbol,
          exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
          isPrimary,
        });
      } else {
        await apiPost('/api/settings/currencies', {
          code,
          symbol,
          exchangeRate: exchangeRate ? parseFloat(exchangeRate) : null,
          isPrimary,
        });
      }
      setDialogOpen(false);
      fetchCurrencies();
    } catch (err) {
      console.error('Failed to save currency:', err);
    }
  }

  if (isLoading) {
    return (
      <DashboardPage>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Currency Management</h1>
            <p className="text-muted-foreground">Manage currencies and exchange rates</p>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Currency
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Currencies</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Exchange Rate</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currencies.map((currency) => (
                  <TableRow key={currency._id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {currency.code}
                        {currency.isPrimary && (
                          <Badge variant="default" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{currency.symbol}</TableCell>
                    <TableCell>
                      {currency.exchangeRate ? currency.exchangeRate.toFixed(4) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {currency.rateTimestamp
                        ? new Date(currency.rateTimestamp).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={currency.isActive ? 'default' : 'secondary'}>
                        {currency.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDialog(currency)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCurrency ? 'Edit Currency' : 'Add Currency'}</DialogTitle>
              <DialogDescription>
                {editingCurrency
                  ? 'Update currency details and exchange rate'
                  : 'Add a new currency to your organization'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editingCurrency && (
                <div className="space-y-2">
                  <Label htmlFor="code">Currency Code (ISO 4217) *</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ETB, USD, etc."
                    maxLength={3}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol *</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="ETB, $, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exchangeRate">Exchange Rate (to primary currency)</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="1.0"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                <Label htmlFor="isPrimary" className="cursor-pointer">
                  Set as primary currency
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardPage>
  );
}

