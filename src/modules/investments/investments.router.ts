import { Router } from 'express';
import investmentsController from './investments.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/portfolio', investmentsController.getPortfolio.bind(investmentsController));
router.get('/holdings', investmentsController.getHoldings.bind(investmentsController));
router.get('/performance', investmentsController.getPerformance.bind(investmentsController));
router.get('/watchlist', investmentsController.getWatchlist.bind(investmentsController));
router.post('/watchlist', investmentsController.addToWatchlist.bind(investmentsController));
router.delete('/watchlist/:ticker', investmentsController.removeFromWatchlist.bind(investmentsController));
router.get('/market/quote', investmentsController.getMarketQuote.bind(investmentsController));
router.get('/market/search', investmentsController.searchAssets.bind(investmentsController));
router.post('/buy', investmentsController.buy.bind(investmentsController));
router.post('/sell', investmentsController.sell.bind(investmentsController));

export default router;
