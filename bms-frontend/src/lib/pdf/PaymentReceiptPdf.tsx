import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Payment } from '@/lib/payments/payments';
import type { Invoice } from '@/lib/invoices/invoices';
import type { Organization } from '@/lib/organizations/organizations';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  header: { fontSize: 20, marginBottom: 8, fontWeight: 700, textAlign: 'center' },
  subheader: { fontSize: 12, marginBottom: 12, color: '#444', textAlign: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    borderBottom: 1,
    borderColor: '#ddd',
    paddingBottom: 4,
  },
  row: { display: 'flex', flexDirection: 'row', marginBottom: 6 },
  label: { width: 140, color: '#555' },
  value: { flex: 1, fontWeight: 500 },
  amountRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTop: 2,
    borderColor: '#000',
  },
  amountLabel: { fontSize: 14, fontWeight: 700 },
  amountValue: { fontSize: 16, fontWeight: 700 },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: 1,
    borderColor: '#ddd',
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
  transactionId: { fontSize: 10, color: '#888', marginTop: 4, fontFamily: 'Courier' },
});

function formatDate(value?: Date | string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(value?: Date | string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function currency(num?: number | null, currencyCode?: string | null): string {
  if (num === undefined || num === null) return '—';
  const code = currencyCode || 'ETB';
  return `${code} ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    telebirr: 'Telebirr',
    cbe_birr: 'CBE Birr',
    chapa: 'Chapa',
    hellocash: 'HelloCash',
    other: 'Other',
  };
  return labels[method] || method;
}

export function PaymentReceiptPdf({
  payment,
  invoice,
  organization,
}: {
  payment: Payment;
  invoice?: Invoice | null;
  organization?: Organization | null;
}) {
  const orgName = organization?.name || 'Organization';
  const orgContact = organization?.contactInfo;
  const paymentDate = formatDateTime(payment.paymentDate);
  const amount = currency(payment.amount, payment.currency);
  const paymentMethod = getPaymentMethodLabel(payment.paymentMethod);
  const transactionId = payment.providerTransactionId || payment.referenceNumber || payment._id;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.section}>
          <Text style={styles.header}>PAYMENT RECEIPT</Text>
          <Text style={styles.subheader}>{orgName}</Text>
          {orgContact?.address && <Text style={styles.subheader}>{orgContact.address}</Text>}
          {orgContact?.phone && <Text style={styles.subheader}>Phone: {orgContact.phone}</Text>}
          {orgContact?.email && <Text style={styles.subheader}>Email: {orgContact.email}</Text>}
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Receipt Number:</Text>
            <Text style={styles.value}>REC-{payment._id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Date:</Text>
            <Text style={styles.value}>{paymentDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment Method:</Text>
            <Text style={styles.value}>{paymentMethod}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{payment.status.toUpperCase()}</Text>
          </View>
          {transactionId && (
            <View style={styles.row}>
              <Text style={styles.label}>Transaction ID:</Text>
              <Text style={[styles.value, styles.transactionId]}>{transactionId}</Text>
            </View>
          )}
        </View>

        {/* Invoice Reference */}
        {invoice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Invoice Reference</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice Number:</Text>
              <Text style={styles.value}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Due Date:</Text>
              <Text style={styles.value}>{formatDate(invoice.dueDate)}</Text>
            </View>
            {invoice.items && invoice.items.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ marginBottom: 4, fontWeight: 700 }}>Invoice Items:</Text>
                {invoice.items.map((item, index) => (
                  <View key={index} style={{ marginLeft: 8, marginBottom: 4 }}>
                    <Text>
                      • {item.description} - {currency(item.amount, invoice.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Amount Paid:</Text>
          <Text style={styles.amountValue}>{amount}</Text>
        </View>

        {/* Notes */}
        {payment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{payment.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated receipt. No signature required.</Text>
          <Text style={{ marginTop: 4 }}>Generated on {formatDateTime(new Date())}</Text>
          {payment.receiptUrl && (
            <Text style={{ marginTop: 4, fontSize: 8 }}>Receipt ID: {payment._id}</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

