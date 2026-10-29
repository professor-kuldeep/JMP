import {routes} from '../../_api/registry';
import {createApiDispatcher} from '../../lib/api-routing.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const dispatch=createApiDispatcher(routes);
export const GET=dispatch;
export const HEAD=dispatch;
export const POST=dispatch;
export const PUT=dispatch;
export const PATCH=dispatch;
export const DELETE=dispatch;
export const OPTIONS=dispatch;
