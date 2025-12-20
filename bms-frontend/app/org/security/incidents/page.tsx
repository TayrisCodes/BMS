'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/lib/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/lib/components/ui/table';
import { Badge } from '@/lib/components/ui/badge';
import { Input } from '@/lib/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/lib/components/ui/select';
import { apiGet } from '@/lib/utils/api-client';
import { DashboardPage } from '@/lib/components/dashboard/DashboardPage';
import { AlertTriangle, Plus, Search, Eye, FileText } from 'lucide-react';

interface Incident {
  id: string;
  organizationId: string;
  buildingId: string;
  unitId?: string | null;
  incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: string | null;
  reportedBy: string;
  reportedAt: string;
  status: 'reported' | 'under_investigation' | 'resolved' | 'closed';
  resolvedAt?: string | null;
  photos?: string[] | null;
  linkedVisitorLogId?: string | null;
  createdAt: string;
}

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchIncidents() {
      try {
        setIsLoading(true);
        const data = await apiGet<{ incidents: Incident[] }>('/api/security/incidents');
        setIncidents(data.incidents || []);
        setFilteredIncidents(data.incidents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load incidents');
      } finally {
        setIsLoading(false);
      }
    }

    fetchIncidents();
  }, []);

  useEffect(() => {
    let filtered = incidents;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(searchLower) ||
          i.description.toLowerCase().includes(searchLower) ||
          i.location?.toLowerCase().includes(searchLower),
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter((i) => i.severity === severityFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((i) => i.incidentType === typeFilter);
    }

    setFilteredIncidents(filtered);
  }, [searchTerm, statusFilter, severityFilter, typeFilter, incidents]);

  function getSeverityBadgeVariant(severity: string) {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'closed':
        return 'secondary';
      case 'resolved':
        return 'default';
      case 'under_investigation':
        return 'default';
      case 'reported':
        return 'outline';
      default:
        return 'outline';
    }
  }

  return (
    <DashboardPage
      title="Security Incidents"
      description="View and manage security incidents"
      icon={<AlertTriangle className="h-5 w-5" />}
    >
      <div className="col-span-full flex justify-between items-center">
        <div className="flex gap-2">
          <Link href="/org/security/incidents/reports">
            <Button variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </Button>
          </Link>
          <Link href="/org/security/incidents/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Report Incident
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="col-span-full bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="col-span-full flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="reported">Reported</SelectItem>
            <SelectItem value="under_investigation">Under Investigation</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="theft">Theft</SelectItem>
            <SelectItem value="vandalism">Vandalism</SelectItem>
            <SelectItem value="trespassing">Trespassing</SelectItem>
            <SelectItem value="violence">Violence</SelectItem>
            <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
            <SelectItem value="fire">Fire</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-full border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reported At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">Loading incidents...</p>
                </TableCell>
              </TableRow>
            ) : filteredIncidents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <p className="text-muted-foreground">
                    {incidents.length === 0
                      ? 'No incidents found.'
                      : 'No incidents match your filters.'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredIncidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">{incident.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{incident.incidentType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSeverityBadgeVariant(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(incident.status)}>
                      {incident.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{incident.location || 'N/A'}</TableCell>
                  <TableCell>{new Date(incident.reportedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/org/security/incidents/${incident.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardPage>
  );
}

