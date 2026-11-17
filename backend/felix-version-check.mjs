import {query,db} from "./src/db.js";
const id="ba22b218-ad1e-49ba-916c-55efdfb4447f";
const sql="SELECT k.id AS document_id,k.current_version,v.id AS version_id,v.version_number,v.is_current,v.original_name FROM knowledge_items k JOIN knowledge_versions v ON v.knowledge_id=k.id WHERE k.id=$1 ORDER BY v.version_number DESC";
const r=await query(sql,[id]); console.log(JSON.stringify(r.rows,null,2)); await db.end();
