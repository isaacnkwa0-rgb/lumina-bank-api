import { Router } from 'express';
import { ratesController } from './rates.controller';

const router = Router();

router.get('/', ratesController.getAll);
router.get('/supported-currencies', ratesController.getSupportedCurrencies);
router.get('/convert', ratesController.convert);
router.get('/:base/:quote', ratesController.getRate);

export { router as ratesRouter };
