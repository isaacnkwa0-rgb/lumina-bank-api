import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Language } from '@prisma/client';
import { usersController } from './users.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

// Ensure upload directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  dateOfBirth: z.string().date().optional(),
  nationality: z.string().length(2).toUpperCase().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  occupation: z.string().max(100).optional(),
  employer: z.string().max(100).optional(),
  annualIncome: z.number().positive().optional(),
  preferredCurrency: z.string().length(3).toUpperCase().optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
  // Onboarding & Consent
  onboardingStep: z.number().int().min(0).max(12).optional(),
  termsAcceptedAt: z.string().datetime().optional(),
  marketingConsent: z.boolean().optional(),
  electronicStatementsConsent: z.boolean().optional(),
  dataProcessingConsent: z.boolean().optional(),
  // Regulatory
  countryOfResidence: z.string().optional(),
  taxResidency: z.array(z.string()).optional(),
  accountType: z.string().optional(),
  // Financial profile
  employmentStatus: z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'STUDENT', 'RETIRED', 'UNEMPLOYED']).optional(),
  industry: z.string().max(100).optional(),
  sourceOfFunds: z.array(z.string()).optional(),
  annualIncomeRange: z.string().optional(),
  expectedMonthlyVolume: z.string().optional(),
});

router.get('/profile', usersController.getProfile);
router.patch('/profile', validate(updateProfileSchema), usersController.updateProfile);
router.post('/avatar', upload.single('avatar'), usersController.uploadAvatar);
router.get('/devices', usersController.getDevices);
router.delete('/devices/:id', usersController.removeDevice);
router.get('/notifications/preferences', usersController.getNotificationPreferences);
router.patch('/notifications/preferences', usersController.updateNotificationPreferences);

export { router as usersRouter };
