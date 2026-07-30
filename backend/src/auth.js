import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { query } from './db.js'
export const roles=['Administrator','Research Manager','Research Officer','Reviewer']
export const createToken=user=>jwt.sign({sub:user.id,email:user.email,role:user.role},config.jwtSecret,{expiresIn:config.jwtExpiresIn,issuer:'psc-app2',audience:'psc-app2-web'})
export async function authenticate(req,res,next){try{const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'Authentication required.'});const payload=jwt.verify(token,config.jwtSecret,{issuer:'psc-app2',audience:'psc-app2-web'});const result=await query('SELECT id,name,email,role,division,status FROM users WHERE id=$1 AND active=TRUE',[payload.sub]);if(!result.rows[0])return res.status(401).json({error:'This account is inactive or no longer exists.'});req.user=result.rows[0];next()}catch{return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'})}}
export const authorize=(...allowed)=>(req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({error:'You do not have permission to perform this action.'})
