import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { query } from './db.js'
export const roles=['Administrator','Research Manager','Research Officer','Reviewer']
export const createToken=user=>jwt.sign({sub:user.id,email:user.email,role:user.role,ver:user.token_version},config.jwtSecret,{expiresIn:config.jwtExpiresIn,issuer:'psc-app2',audience:'psc-app2-web'})
export async function authenticate(req,res,next){try{const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'Authentication required.'});const payload=jwt.verify(token,config.jwtSecret,{issuer:'psc-app2',audience:'psc-app2-web'});const result=await query('SELECT id,name,email,role,division,status,token_version FROM users WHERE id=$1 AND active=TRUE',[payload.sub]);const user=result.rows[0];if(!user||payload.ver!==user.token_version)return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'});req.user=user;req.token=token;next()}catch{return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'})}}
export const authorize=(...allowed)=>async(req,res,next)=>{
  if(allowed.includes(req.user.role))return next()
  const userAdministrationPath=/^\/(?:api\/)?users(?:\/[^/]+(?:\/(?:role|reset-password))?)?$/
  const isManagerUserAdministration=req.user.role==='Research Manager'&&allowed.length===1&&allowed[0]==='Administrator'&&userAdministrationPath.test(req.path)
  if(!isManagerUserAdministration)return res.status(403).json({error:'You do not have permission to perform this action.'})
  if(/^\/(?:api\/)?users$/.test(req.path)){
    if(req.body?.role==='Administrator')return res.status(403).json({error:'Research Managers cannot create Administrator accounts.'})
    return next()
  }
  try{
    const targetId=req.params?.id||req.path.split('/')[3]
    const target=(await query('SELECT role FROM users WHERE id=$1',[targetId])).rows[0]
    if(!target)return res.status(404).json({error:'Member not found.'})
    if(target.role==='Administrator'||req.body?.role==='Administrator')return res.status(403).json({error:'Only an Administrator can manage Administrator accounts or grant the Administrator role.'})
    return next()
  }catch(error){return next(error)}
}
