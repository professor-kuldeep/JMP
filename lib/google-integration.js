import {GoogleAuth,OAuth2Client} from 'google-auth-library';
import {analyticsError} from './traffic.mjs';
import {GOOGLE_SCOPES,googleEnvironment,openGoogle,sealGoogle} from './google-secrets.mjs';
import {readGoogleConnection,saveGoogleConnection} from './insights-store';
import {fetchGa4Report,fetchGscReport,googleJson} from './google-reports.mjs';
const cache=new Map();
export function clearGoogleCache(){cache.clear();}
export function oauthClient(){if(!googleEnvironment().oauthConfigured)throw analyticsError('Google OAuth setup is incomplete. Add the server settings listed in Connections.',503);return new OAuth2Client({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI,transporterOptions:{timeout:12000}});}
export async function googleConnectionStatus(){let connection=null,storageReady=true,message='';try{connection=await readGoogleConnection();}catch(error){storageReady=false;message=error.message;}return {...googleEnvironment(),authorized:Boolean(connection?.encryptedTokens),connectedAt:connection?.connectedAt||null,connectedBy:connection?.connectedBy||'',storageReady,message};}
export async function saveGoogleTokens(tokens,username){if(!tokens.refresh_token)throw analyticsError('Google did not issue offline access. Reconnect and approve the requested reporting permissions.',400);await saveGoogleConnection({encryptedTokens:sealGoogle(tokens),connectedAt:new Date().toISOString(),connectedBy:username,scopes:String(tokens.scope||'').split(' ')});clearGoogleCache();}
export async function googleAccessToken(mode){
 try{
  if(mode==='service_account'){
   let credentials;try{credentials=JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'');}catch{throw analyticsError('Add valid GOOGLE_SERVICE_ACCOUNT_JSON in the hosting environment.',503);}
   if(!credentials.client_email||!credentials.private_key)throw analyticsError('The Google server credentials are incomplete.',503);
   const auth=new GoogleAuth({credentials,scopes:GOOGLE_SCOPES});const client=await auth.getClient();const result=await client.getAccessToken();if(!result.token)throw new Error();return result.token;
  }
  const connection=await readGoogleConnection();if(!connection?.encryptedTokens)throw analyticsError('Connect a Google account in Connections to read reports.',503);
  const client=oauthClient();const previous=openGoogle(connection.encryptedTokens);client.setCredentials(previous);
  const result=await client.getAccessToken();if(!result.token)throw new Error();
  if(client.credentials.expiry_date!==previous.expiry_date||client.credentials.refresh_token!==previous.refresh_token)await saveGoogleConnection({...connection,encryptedTokens:sealGoogle({...previous,...client.credentials})});
  return result.token;
 }catch(error){if(error.code==='ANALYTICS_ERROR'||error.code==='ANALYTICS_STORAGE')throw error;throw analyticsError('Google authorization could not be refreshed. Check server credentials or reconnect Google.',503);}
}
export async function disconnectGoogle(){const connection=await readGoogleConnection();let revoked=true;
 if(connection?.encryptedTokens){try{const tokens=openGoogle(connection.encryptedTokens);await oauthClient().revokeToken(tokens.refresh_token||tokens.access_token);}catch{revoked=false;}}
 await saveGoogleConnection(null);clearGoogleCache();return {revoked};
}
export async function googleSites(mode){return (await googleJson('https://www.googleapis.com/webmasters/v3/sites',await googleAccessToken(mode))).siteEntry||[];}
export async function googleReports(settings,range,refresh=false){
 const mode=settings.googleConnectionMode||'oauth';let tokenPromise;
 const token=()=>tokenPromise||(tokenPromise=googleAccessToken(mode));
 const get=async(provider,id,run)=>{
  if(!id)return {status:'not_configured',message:provider==='ga4'?'Add the numeric GA4 Property ID in Connections.':'Select your exact GSC property in Connections.'};
  const key=[provider,mode,id,range.startDate,range.endDate].join('|'),cached=cache.get(key);if(!refresh&&cached&&Date.now()-cached.at<300000)return {...cached.value,cached:true};
  try{const data=await run(await token());const value={status:'connected',data,fetchedAt:new Date().toISOString(),cached:false};cache.set(key,{at:Date.now(),value});if(cache.size>40)cache.delete(cache.keys().next().value);return value;}catch(error){return {status:'error',message:['ANALYTICS_ERROR','ANALYTICS_STORAGE','GOOGLE_REPORT'].includes(error.code)?error.message:'Google reporting is temporarily unavailable.'};}
 };
 const [ga4,gsc]=await Promise.all([get('ga4',settings.ga4PropertyId,t=>fetchGa4Report(settings.ga4PropertyId,range,t)),get('gsc',settings.gscProperty,t=>fetchGscReport(settings.gscProperty,range,t))]);return {ga4,gsc};
}
