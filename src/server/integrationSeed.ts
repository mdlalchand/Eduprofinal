import crypto from 'node:crypto';
import type {
  AcademicClassSection,
  AcademicSubject,
  AcademicYear,
  CourseRoutineItem,
  FeeInvoice,
  IntegrationConfig,
  StudentAdmissionRecord,
} from '../types';

export function createDefaultIntegrations(): IntegrationConfig[] {
  const now = new Date().toISOString();
  const hasGeminiEnv = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 8);
  const hasSmtpEnv = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasBkashEnv = Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET);
  const hasNagadEnv = Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_PRIVATE_KEY);
  const hasSslEnv = Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWD);
  const hasSmsEnv = Boolean(process.env.BULKSMS_API_KEY && process.env.BULKSMS_SENDER_ID);
  const hasWhatsappEnv = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

  return [
    {
      id: 'int-bkash',
      key: 'bkash',
      name: 'bKash Tokenized Checkout',
      category: 'Payment',
      description: 'Official bKash Tokenized Payment API with server-side grant token, create/execute payment, and webhook verification.',
      enabled: true,
      mode: process.env.BKASH_MODE === 'live' ? 'live' : 'sandbox',
      configured: hasBkashEnv,
      healthStatus: hasBkashEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        baseUrl: process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
        merchantAccount: process.env.BKASH_MERCHANT_ACCOUNT || '',
      },
      secretsMasked: {
        appKey: hasBkashEnv ? 'bkash_••••env' : 'Not Configured',
        appSecret: hasBkashEnv ? '••••••••env' : 'Not Configured',
        username: hasBkashEnv ? '••••••••env' : 'Not Configured',
        password: hasBkashEnv ? '••••••••env' : 'Not Configured',
        webhookSecret: process.env.BKASH_WEBHOOK_SECRET ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-nagad',
      key: 'nagad',
      name: 'Nagad Checkout API',
      category: 'Payment',
      description: 'Nagad merchant payment initiation, challenge signature verification, and server callback reconciliation.',
      enabled: true,
      mode: process.env.NAGAD_MODE === 'live' ? 'live' : 'sandbox',
      configured: hasNagadEnv,
      healthStatus: hasNagadEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        merchantId: process.env.NAGAD_MERCHANT_ID || '',
        baseUrl: process.env.NAGAD_BASE_URL || 'https://sandbox.mynagad.com:10080/remote-payment-gateway-1.0',
      },
      secretsMasked: {
        publicKey: hasNagadEnv ? '••••••••env' : 'Not Configured',
        privateKey: hasNagadEnv ? '••••••••env' : 'Not Configured',
        webhookSecret: process.env.NAGAD_WEBHOOK_SECRET ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-sslcommerz',
      key: 'sslcommerz',
      name: 'SSLCommerz Payment Gateway',
      category: 'Payment',
      description: 'Visa, Mastercard, Amex, DBBL Nexus & NetBanking with server-side IPN validation.',
      enabled: true,
      mode: process.env.SSLCOMMERZ_MODE === 'live' ? 'live' : 'sandbox',
      configured: hasSslEnv,
      healthStatus: hasSslEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        storeId: process.env.SSLCOMMERZ_STORE_ID || '',
        baseUrl: process.env.SSLCOMMERZ_BASE_URL || 'https://sandbox.sslcommerz.com',
      },
      secretsMasked: {
        storePassword: hasSslEnv ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-smtp',
      key: 'smtp_email',
      name: 'SMTP / Transactional Email',
      category: 'Email',
      description: 'Real email delivery for password resets, admission receipts, invoices, and exam alerts.',
      enabled: hasSmtpEnv,
      mode: 'live',
      configured: hasSmtpEnv,
      healthStatus: hasSmtpEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || '587',
        fromEmail: process.env.SMTP_FROM || '',
      },
      secretsMasked: {
        username: hasSmtpEnv ? '••••••••env' : 'Not Configured',
        password: hasSmtpEnv ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-sms',
      key: 'bulksms_bd',
      name: 'BulkSMS BD & OTP Gateway',
      category: 'SMS',
      description: 'Bangladesh SMS delivery for OTP verification, fee reminders, and guardian absent alerts.',
      enabled: hasSmsEnv,
      mode: hasSmsEnv ? 'live' : 'sandbox',
      configured: hasSmsEnv,
      healthStatus: hasSmsEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        endpoint: process.env.BULKSMS_ENDPOINT || 'https://bulksmsbd.net/api/smsapi',
        senderId: process.env.BULKSMS_SENDER_ID || '',
      },
      secretsMasked: {
        apiKey: hasSmsEnv ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-whatsapp',
      key: 'whatsapp_cloud',
      name: 'WhatsApp Business Cloud API',
      category: 'WhatsApp',
      description: 'Meta WhatsApp Cloud API for live class reminders, invoices, and parent notifications.',
      enabled: hasWhatsappEnv,
      mode: hasWhatsappEnv ? 'live' : 'sandbox',
      configured: hasWhatsappEnv,
      healthStatus: hasWhatsappEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        apiVersion: 'v20.0',
      },
      secretsMasked: {
        accessToken: hasWhatsappEnv ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-zoom',
      key: 'zoom_live',
      name: 'Zoom Server-to-Server OAuth',
      category: 'Live Video',
      description: 'Automated live class meeting generation and attendance sync for batches.',
      enabled: Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
      mode: 'live',
      configured: Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET),
      healthStatus:
        process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET
          ? 'configured'
          : 'awaiting_configuration',
      publicConfig: {
        accountId: process.env.ZOOM_ACCOUNT_ID || '',
      },
      secretsMasked: {
        clientId: process.env.ZOOM_CLIENT_ID ? '••••••••env' : 'Not Configured',
        clientSecret: process.env.ZOOM_CLIENT_SECRET ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-youtube',
      key: 'youtube_api',
      name: 'YouTube Unlisted & Live Embeds',
      category: 'Live Video',
      description: 'Embed unlisted lessons and YouTube Live streams without making misleading DRM claims.',
      enabled: Boolean(process.env.YOUTUBE_API_KEY),
      mode: 'live',
      configured: Boolean(process.env.YOUTUBE_API_KEY),
      healthStatus: process.env.YOUTUBE_API_KEY ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        channelId: process.env.YOUTUBE_CHANNEL_ID || '',
      },
      secretsMasked: {
        apiKey: process.env.YOUTUBE_API_KEY ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-gemini',
      key: 'gemini_ai',
      name: 'Google Gemini AI Engine',
      category: 'AI',
      description: 'Powers bilingual AI grammar tutor, question generation, and academic analytics.',
      enabled: hasGeminiEnv,
      mode: 'live',
      configured: hasGeminiEnv,
      healthStatus: hasGeminiEnv ? 'configured' : 'awaiting_configuration',
      publicConfig: {
        model: 'gemini-2.5-flash',
      },
      secretsMasked: {
        apiKey: hasGeminiEnv ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-google-analytics',
      key: 'ga4_gtm',
      name: 'Google Analytics 4 & Tag Manager',
      category: 'Analytics & Ads',
      description: 'Measurement ID and GTM container injection controlled from Central Integration Manager.',
      enabled: Boolean(process.env.GA4_MEASUREMENT_ID || process.env.GTM_CONTAINER_ID),
      mode: 'live',
      configured: Boolean(process.env.GA4_MEASUREMENT_ID || process.env.GTM_CONTAINER_ID),
      healthStatus:
        process.env.GA4_MEASUREMENT_ID || process.env.GTM_CONTAINER_ID
          ? 'configured'
          : 'awaiting_configuration',
      publicConfig: {
        measurementId: process.env.GA4_MEASUREMENT_ID || '',
        gtmId: process.env.GTM_CONTAINER_ID || '',
      },
      secretsMasked: {
        measurementApiSecret: process.env.GA4_API_SECRET ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-meta-capi',
      key: 'meta_pixel_capi',
      name: 'Meta Pixel & Conversion API',
      category: 'Analytics & Ads',
      description: 'Course purchase and admission event tracking via Meta Pixel and server-side CAPI.',
      enabled: Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN),
      mode: 'live',
      configured: Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN),
      healthStatus:
        process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN
          ? 'configured'
          : 'awaiting_configuration',
      publicConfig: {
        pixelId: process.env.META_PIXEL_ID || '',
      },
      secretsMasked: {
        accessToken: process.env.META_CAPI_TOKEN ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-firebase',
      key: 'firebase_fcm',
      name: 'Firebase Cloud Messaging (FCM)',
      category: 'Google',
      description: 'Browser and mobile push notifications for live class starts and exam publications.',
      enabled: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVER_KEY),
      mode: 'live',
      configured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVER_KEY),
      healthStatus:
        process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVER_KEY
          ? 'configured'
          : 'awaiting_configuration',
      publicConfig: {
        projectId: process.env.FIREBASE_PROJECT_ID || '',
      },
      secretsMasked: {
        serviceAccountJson: process.env.FIREBASE_SERVER_KEY ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
    {
      id: 'int-cloud-storage',
      key: 'cloud_storage',
      name: 'Off-Site Backup & S3/R2 Storage',
      category: 'Cloud & Storage',
      description: 'Remote object storage destination for automated database backups and study assets.',
      enabled: Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID),
      mode: 'live',
      configured: Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID),
      healthStatus:
        process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID
          ? 'configured'
          : 'awaiting_configuration',
      publicConfig: {
        endpoint: process.env.S3_ENDPOINT || '',
        bucket: process.env.S3_BUCKET || '',
        region: process.env.S3_REGION || 'ap-southeast-1',
      },
      secretsMasked: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ? '••••••••env' : 'Not Configured',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ? '••••••••env' : 'Not Configured',
      },
      updatedAt: now,
    },
  ];
}

export function createDefaultAcademicCollections() {
  const academicYears: AcademicYear[] = [
    {
      id: 'ay-2026',
      name: 'Academic Session 2026',
      code: 'AY-2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: true,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const academicClasses: AcademicClassSection[] = [
    {
      id: 'cls-ssc27-mpr',
      academicYearId: 'ay-2026',
      branchId: 'br-mirpur',
      className: 'SSC 27 (Class 10)',
      sectionName: 'Section A — Evening',
      roomLabel: 'Room 201',
      capacity: 60,
      classTeacherUserId: 'u-teacher',
      status: 'active',
    },
    {
      id: 'cls-hsc27-utr',
      academicYearId: 'ay-2026',
      branchId: 'br-uttara',
      className: 'HSC 27 (Class 11-12)',
      sectionName: 'Section A — Morning',
      roomLabel: 'Room 402',
      capacity: 50,
      classTeacherUserId: 'u-teacher',
      status: 'active',
    },
  ];

  const academicSubjects: AcademicSubject[] = [
    {
      id: 'sub-eng-1',
      code: 'ENG-101',
      name: 'English 1st Paper (Textual, Flow Chart & Writing)',
      classLevel: 'SSC / HSC',
      courseId: 'crs-hsc-combo',
      creditsOrMarks: 100,
      status: 'active',
    },
    {
      id: 'sub-eng-2',
      code: 'ENG-102',
      name: 'English 2nd Paper (Grammar & Freehand Composition)',
      classLevel: 'SSC / HSC',
      courseId: 'crs-frpb-ssc',
      creditsOrMarks: 100,
      status: 'active',
    },
    {
      id: 'sub-ielts',
      code: 'IELTS-800',
      name: 'IELTS Academic & GT 4 Modules',
      classLevel: 'IELTS',
      courseId: 'crs-ielts-pro',
      creditsOrMarks: 100,
      status: 'active',
    },
  ];

  const courseRoutines: CourseRoutineItem[] = [
    {
      id: 'rtn-1',
      courseId: 'crs-frpb-ssc',
      batchId: 'bat-ssc-mpr-1',
      branchId: 'br-mirpur',
      subjectId: 'sub-eng-2',
      teacherUserId: 'u-teacher',
      dayOfWeek: 'Sun',
      startTime: '16:30',
      endTime: '18:00',
      roomOrLink: 'Mirpur Room 201 + Hybrid',
      status: 'active',
    },
    {
      id: 'rtn-2',
      courseId: 'crs-frpb-ssc',
      batchId: 'bat-ssc-mpr-1',
      branchId: 'br-mirpur',
      subjectId: 'sub-eng-2',
      teacherUserId: 'u-teacher',
      dayOfWeek: 'Tue',
      startTime: '16:30',
      endTime: '18:00',
      roomOrLink: 'Mirpur Room 201 + Hybrid',
      status: 'active',
    },
  ];

  const studentAdmissions: StudentAdmissionRecord[] = [
    {
      id: 'adm-2026-101',
      admissionNo: 'ADM-AEC-2026-001',
      studentUserId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      academicYearId: 'ay-2026',
      classSectionId: 'cls-ssc27-mpr',
      guardianName: 'Kamrul Hasan (Guardian)',
      guardianPhone: '01710000005',
      bloodGroup: 'O+',
      emergencyContact: '01710000005',
      admissionFeePaid: 2490,
      admissionStatus: 'active',
      admittedAt: '2026-02-05T11:00:00.000Z',
    },
    {
      id: 'adm-2026-102',
      admissionNo: 'ADM-AEC-2026-002',
      studentUserId: 'u-student-2',
      studentName: 'Farhana Yasmin',
      rollNumber: 'AEC-2026-102',
      branchId: 'br-uttara',
      academicYearId: 'ay-2026',
      classSectionId: 'cls-hsc27-utr',
      admissionFeePaid: 4990,
      admissionStatus: 'active',
      admittedAt: '2026-02-18T15:00:00.000Z',
    },
  ];

  const feeInvoices: FeeInvoice[] = [
    {
      id: 'inv-seed-1',
      invoiceNo: 'INV-AEC-202601',
      studentUserId: 'u-student',
      studentName: 'Arafat Rahman',
      branchId: 'br-mirpur',
      courseId: 'crs-frpb-ssc',
      batchId: 'bat-ssc-mpr-1',
      feeType: 'tuition',
      title: 'SSC-27 Final Revision Batch Tuition Fee',
      totalAmount: 2490,
      paidAmount: 2490,
      dueAmount: 0,
      dueDate: '2026-02-10',
      status: 'paid',
      createdAt: '2026-02-05T11:00:00.000Z',
      updatedAt: '2026-02-12T10:30:00.000Z',
    },
    {
      id: 'inv-seed-2',
      invoiceNo: 'INV-AEC-202602',
      studentUserId: 'u-student',
      studentName: 'Arafat Rahman',
      branchId: 'br-mirpur',
      courseId: 'crs-hsc-combo',
      feeType: 'tuition',
      title: 'HSC 27-28 English Combo Admission Fee (Pending Counter Payment)',
      totalAmount: 3490,
      paidAmount: 0,
      dueAmount: 3490,
      dueDate: '2026-12-01',
      status: 'unpaid',
      createdAt: '2026-03-06T09:30:00.000Z',
      updatedAt: '2026-03-06T09:30:00.000Z',
    },
  ];

  return {
    academicYears,
    academicClasses,
    academicSubjects,
    courseRoutines,
    studentAdmissions,
    feeInvoices,
  };
}

export function encryptIntegrationSecret(plaintext: string, encryptionKey: string): string {
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptIntegrationSecret(ciphertext: string, encryptionKey: string): string {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) return '';
  try {
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
