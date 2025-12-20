# Notification Templates

This directory contains multi-language message templates for notifications.

## Structure

Templates are organized by notification type and language:

```
templates/
  invoice_created/
    en.ts
    am.ts
    om.ts
    ti.ts
  payment_due/
    en.ts
    am.ts
    om.ts
    ti.ts
  visitor_arrived/
    en.ts
    am.ts
    om.ts
    ti.ts
  ...
```

## Language Codes

- `en` - English
- `am` - Amharic (አማርኛ)
- `om` - Afaan Oromo
- `ti` - Tigrigna (ትግርኛ)

## Usage

Templates are loaded dynamically based on user's preferred language and fallback to English if not available.

