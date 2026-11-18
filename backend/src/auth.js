import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { query } from './db.js'
import {canManageEntity,canManageUser,isTeamScopeRole,managedUserIds} from './scope.js'
export const roles=['System Admin','Director','Deputy Director','Assistant Director','Researcher']
export const managementRoles=['System Admin','Director','Deputy Director','Assistant Director']
export const isManagementRole=role=>managementRoles.includes(role)
export const createToken=(user,expiresIn=config.jwtExpiresIn)=>jwt.sign({sub:user.id,email:user.email,role:user.role,ver:user.token_version},config.jwtSecret,{expiresIn,issuer:'psc-app2',audience:'psc-app2-web'})
export async function authenticate(req,res,next){try{const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');if(!token)return res.status(401).json({error:'Authentication required.'});const payload=jwt.verify(token,config.jwtSecret,{issuer:'psc-app2',audience:'psc-app2-web'});const result=await query(`SELECT u.id,u.name,u.email,u.role,u.division,u.status,u.token_version,u.must_change_password,u.supervisor_id,
  supervisor.name supervisor_name,supervisor.role supervisor_role
  FROM users u LEFT JOIN users supervisor ON supervisor.id=u.supervisor_id
  WHERE u.id=$1 AND u.active=TRUE`,[payload.sub]);const user=result.rows[0];if(!user||payload.ver!==user.token_version)return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'});req.user=user;req.token=token;if(user.must_change_password){
  const allowed=(req.method==='GET'&&req.path==='/api/auth/me')
    ||(req.method==='POST'&&(req.path==='/api/auth/change-password'||req.path==='/api/auth/logout'));
  if(!allowed)return res.status(403).json({error:'You must change your temporary password before continuing.',code:'PASSWORD_CHANGE_REQUIRED'});
}next()}catch{return res.status(401).json({error:'Your session is invalid or has expired. Please sign in again.'})}}
export const authorize=(...allowed)=>async(req,res,next)=>{
  if(allowed.includes(req.user.role))return next()
  // Leadership roles inherit legacy manager-gated operations, but Deputy and
  // Assistant Directors remain strictly limited to their reporting subtree.
  if(allowed.includes('Deputy Director')&&isManagementRole(req.user.role)){
    if(isTeamScopeRole(req.user.role)){
      const match=req.path.match(/\/(?:api\/)?(assignments|research|knowledge|documents|users)\/([0-9a-f-]{36})(?:\/|$)/i)
      if(match){
        const kind=match[1]==='assignments'?'assignment':match[1]==='research'?'research':match[1]==='users'?'user':'knowledge'
        if(!await canManageEntity(req.user,kind,match[2]))return res.status(403).json({error:'This record is outside your permitted team scope.'})
      }
    }
    return next()
  }
  const userAdministrationPath=/^\/(?:api\/)?users(?:\/[^/]+(?:\/(?:role|reset-password))?)?$/
  const isManagerUserAdministration=isManagementRole(req.user.role)&&req.user.role!=='System Admin'&&allowed.length===1&&allowed[0]==='System Admin'&&userAdministrationPath.test(req.path)
  if(!isManagerUserAdministration)return res.status(403).json({error:'You do not have permission to perform this action.'})
  if(/^\/(?:api\/)?users$/.test(req.path)){
    if(req.body?.role==='System Admin')return res.status(403).json({error:'Only a System Admin can create System Admin accounts.'})
    if(isTeamScopeRole(req.user.role)&&req.body?.supervisorId){
      const ids=await managedUserIds(req.user)
      if(!ids.includes(req.body.supervisorId))return res.status(403).json({error:'You can create staff only within your reporting subtree.'})
    }
    return next()
  }
  try{
    const targetId=req.params?.id||req.path.split('/')[3]
    const target=(await query('SELECT role FROM users WHERE id=$1',[targetId])).rows[0]
    if(!target)return res.status(404).json({error:'Member not found.'})
    if(target.role==='System Admin'||req.body?.role==='System Admin')return res.status(403).json({error:'Only a System Admin can manage System Admin accounts or grant the System Admin role.'})
    if(isTeamScopeRole(req.user.role)&&!await canManageUser(req.user,targetId))return res.status(403).json({error:'This member is outside your reporting subtree.'})
    return next()
  }catch(error){return next(error)}
}
