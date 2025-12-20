import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Lease } from '@/lib/leases/leases';
import type { Tenant } from '@/lib/tenants/tenants';
import type { Unit } from '@/lib/units/units';
import type { Building } from '@/lib/buildings/buildings';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  header: { fontSize: 18, marginBottom: 8, fontWeight: 700 },
  subheader: { fontSize: 12, marginBottom: 12, color: '#444' },
  section: { marginBottom: 12 },
  row: { display: 'flex', flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, color: '#555' },
  value: { flex: 1, fontWeight: 500 },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#ddd',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 2 },
  cell: { flex: 1 },
  strong: { fontWeight: 700 },
});

function formatDate(value?: Date | string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString();
}

function currency(num?: number | null): string {
  if (num === undefined || num === null) return '—';
  return `ETB ${num.toLocaleString()}`;
}

export function LeasePdf({
  lease,
  tenant,
  unit,
  building,
}: {
  lease: Lease;
  tenant?: Tenant;
  unit?: Unit;
  building?: Building | null;
}) {
  const rent = lease.rentAmount ?? lease.terms?.rent ?? 0;
  const deposit = lease.depositAmount ?? lease.terms?.deposit ?? null;
  const serviceCharges = lease.terms?.serviceCharges ?? null;
  const penalty = lease.penaltyConfig;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Lease Agreement Summary</Text>
        <Text style={styles.subheader}>Lease ID: {lease._id}</Text>

        <View style={styles.section}>
          <Text style={styles.strong}>Parties & Unit</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Tenant</Text>
            <Text style={styles.value}>
              {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Unit</Text>
            <Text style={styles.value}>
              {unit ? unit.unitNumber : '—'}
              {building ? `, ${building.name}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.strong}>Terms</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Start Date</Text>
            <Text style={styles.value}>{formatDate(lease.startDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>End Date</Text>
            <Text style={styles.value}>{formatDate(lease.endDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Billing</Text>
            <Text style={styles.value}>
              {lease.billingCycle} •{' '}
              {lease.dueDay
                ? `Due Day ${lease.dueDay}`
                : `Due ${lease.paymentDueDays ?? 7} days after invoice`}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Rent</Text>
            <Text style={styles.value}>{currency(rent)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Service Charges</Text>
            <Text style={styles.value}>{currency(serviceCharges)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Deposit</Text>
            <Text style={styles.value}>{currency(deposit)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.strong}>Penalties</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Late Fee</Text>
            <Text style={styles.value}>
              {penalty?.lateFeeRatePerDay
                ? `${(penalty.lateFeeRatePerDay * 100).toFixed(2)}% per day`
                : '—'}
              {penalty?.lateFeeGraceDays ? ` after ${penalty.lateFeeGraceDays} days` : ''}
              {penalty?.lateFeeCapDays ? ` (cap ${penalty.lateFeeCapDays} days)` : ''}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Due</Text>
            <Text style={styles.value}>
              {lease.paymentDueDays ? `${lease.paymentDueDays} days after invoice` : '—'}
            </Text>
          </View>
        </View>

        {lease.customTermsText && (
          <View style={styles.section}>
            <Text style={styles.strong}>Custom Terms</Text>
            <Text>{lease.customTermsText}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.strong}>Status</Text>
          <Text>
            Status: {lease.status}
            {lease.nextInvoiceDate ? ` • Next Invoice: ${formatDate(lease.nextInvoiceDate)}` : ''}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

