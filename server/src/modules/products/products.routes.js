import express from 'express';
import { notImplemented } from '../../utils/notImplemented.js';

const router = express.Router();
router.all(['/', '/filters', '/:id'], notImplemented);
export default router;
