import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const username = (process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin').toLowerCase();
const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME || 'Primary Administrator';
if (!url || !serviceKey || !email || !password) {
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD');
  process.exit(1);
}
if (password.length < 12) { console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.'); process.exit(1); }
const db = createClient(url, serviceKey, { auth: { autoRefreshToken:false, persistSession:false } });
function base32(buffer){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';const bits=[...buffer].map(b=>b.toString(2).padStart(8,'0')).join('');let output='';for(let i=0;i<bits.length;i+=5)output+=alphabet[parseInt(bits.slice(i,i+5).padEnd(5,'0'),2)];return output;}
function recoveryCodes(count=8){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:count},()=>{const bytes=crypto.randomBytes(12);let out='';for(let i=0;i<12;i++)out+=alphabet[bytes[i]%alphabet.length];return `${out.slice(0,4)}-${out.slice(4,8)}-${out.slice(8,12)}`;});}
function hmacRecovery(code){const secret=process.env.ADMIN_SECRET||'';if(secret.length<32){console.error('ADMIN_SECRET must be at least 32 characters before bootstrapping.');process.exit(1);}return crypto.createHmac('sha256',secret).update(code.replace(/\s+/g,'').toUpperCase()).digest('hex');}
const totpSecret=base32(crypto.randomBytes(20));
const recovery=recoveryCodes();
const { data: created, error: createError } = await db.auth.admin.createUser({ email, password, email_confirm:true, user_metadata:{username,display_name:displayName} });
let user=created?.user;
if(createError){
  const {data:list,error:listError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(listError) throw listError;
  user=list?.users?.find(u=>u.email?.toLowerCase()===email.toLowerCase());
  if(!user) throw createError;
  const {error:updateError}=await db.auth.admin.updateUserById(user.id,{password,email_confirm:true,user_metadata:{username,display_name:displayName}});
  if(updateError) throw updateError;
}
const row={user_id:user.id,username,display_name:displayName,email:email.toLowerCase(),role:'super_admin',totp_secret:totpSecret,two_factor_enabled:true,recovery_code_hashes:recovery.map(hmacRecovery),disabled:false,must_change_password:false,source:'bootstrap-script',updated_at:new Date().toISOString()};
const {error:profileError}=await db.from('cms_profiles').upsert(row,{onConflict:'user_id'});if(profileError)throw profileError;
const issuer=process.env.ADMIN_TOTP_ISSUER||'JM Pabari CoreTax CMS';
const uri=`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
console.log('\nSuper Admin created/updated successfully.\n');
console.log('Username:',username);console.log('Email:',email);console.log('TOTP secret:',totpSecret);console.log('Authenticator URI:',uri);console.log('\nRecovery codes (save once):');recovery.forEach(c=>console.log('  '+c));console.log('\nRemove BOOTSTRAP_ADMIN_PASSWORD from your shell/history after use.');
