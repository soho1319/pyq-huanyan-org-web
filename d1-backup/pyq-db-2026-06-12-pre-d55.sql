PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_init.sql','2026-06-10 10:27:28');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_user_settings.sql','2026-06-10 11:47:29');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_user_theme.sql','2026-06-10 11:57:29');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_ai_drafts.sql','2026-06-10 13:32:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_d29_multi_slot.sql','2026-06-11 02:32:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_d30_d31.sql','2026-06-11 03:00:54');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_d36_cycle_themes.sql','2026-06-11 05:37:45');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_d37_weekday_weights.sql','2026-06-11 06:07:57');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'0009_d46_addon.sql','2026-06-11 10:41:36');
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         
  display_name TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,  
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
INSERT INTO "users" ("id","username","password_hash","display_name","is_admin","created_at","updated_at") VALUES('8e7776e3-e0a8-465e-b39a-c083e0c63642','admin','pbkdf2$100000$_cceqRAfenfQaUedrbsTNQ$6RaA-KazzF6rX4Wvn4B4qgXDoHfNP7iL9nSfQE9Uy4s','admin',1,1781087484363,NULL);
INSERT INTO "users" ("id","username","password_hash","display_name","is_admin","created_at","updated_at") VALUES('866080cc-89bb-4d17-8023-64dc5b98c7af','cici','pbkdf2$100000$jiNPuiBlycXTcEl5I2HrfQ$lB9ILClg5oVTwTavBSJXp7SYc5wUIKATZOBGpuP-aKI','cici',0,1781087484363,NULL);
INSERT INTO "users" ("id","username","password_hash","display_name","is_admin","created_at","updated_at") VALUES('ed44710b-78f5-4eab-80f7-f46512ae77f8','cc','pbkdf2$100000$HGyG7ijT_WNfM8uTlRkC4g$i15_NC0RmRKBUlibOdc9A_9EhETv1nhpJd-ZY7cHd9c','cc',0,1781087484363,NULL);
INSERT INTO "users" ("id","username","password_hash","display_name","is_admin","created_at","updated_at") VALUES('test-user-1','testuser','pbkdf2$100000$i3LEpvKRJJFhsUcilKnb7g==$jbSK2sZnRPaoUSO8DyJvJRawvsvoqnDOSICirg0TFdw=','测试用户',0,1749660000000,NULL);
CREATE TABLE intros (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slot TEXT NOT NULL,                    
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('c0b20e75-062d-4967-ba21-b5232fab9ca9','8e7776e3-e0a8-465e-b39a-c083e0c63642','short3','做内容营销 8 年，专注朋友圈成交',1781088638562);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('8e53b90d-6e98-4b86-abf6-67960be1f637','8e7776e3-e0a8-465e-b39a-c083e0c63642','50','内容营销教练，朋友圈文案 + SOP 落地',1781088638562);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('dd6e2674-5c70-4ce4-93a7-db15c8a2f6ef','8e7776e3-e0a8-465e-b39a-c083e0c63642','1min','我是 admin，做了 8 年内容营销，专注朋友圈成交。帮 100+ 老板把朋友圈变成自动接单机器。',1781088638562);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('3c5ea292-b4f2-4daa-87c5-7738f31dda54','8e7776e3-e0a8-465e-b39a-c083e0c63642','200','admin · 内容营销教练 · 8 年实战 · 专注朋友圈成交体系',1781088638562);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('a5923aaf-9e81-47d9-b74f-91d2883d7c50','8e7776e3-e0a8-465e-b39a-c083e0c63642','addwechat','扫码加我，朋友圈文案 1v1 咨询',1781088638562);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('7421df7e-92bd-4bf9-8d57-721593b27aad','ed44710b-78f5-4eab-80f7-f46512ae77f8','50','',1781101176069);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('5c54ba49-6117-4055-9b68-678d1aa4b8db','ed44710b-78f5-4eab-80f7-f46512ae77f8','200','',1781101176069);
INSERT INTO "intros" ("id","user_id","slot","content","updated_at") VALUES('2f5ba548-aecc-456f-84ef-65f8067660b5','ed44710b-78f5-4eab-80f7-f46512ae77f8','short3','',1781101176069);
CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,                             
  persona TEXT,                          
  pain TEXT,                             
  action TEXT,                           
  result TEXT,                           
  testimonial TEXT,                      
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "cases" ("id","user_id","name","persona","pain","action","result","testimonial","sort_order","created_at","updated_at") VALUES('66334940-91e6-4dfa-8b39-2785d9cdbbb1','8e7776e3-e0a8-465e-b39a-c083e0c63642','张姐（餐饮老板）','成都火锅店老板，48 岁','朋友圈发了一堆菜品图，没人加微，店里生意下滑','参加朋友圈文案课，按 7-天 SOP 发，加 1v1 咨询钩子','30 天加微 287 个，到店 42 个，营业额涨 35%','原来朋友圈还能这样做，照着发就有客户加我，太神奇了！',1,1781088665236,NULL);
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT,                         
  source TEXT,                           
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "quotes" ("id","user_id","text","category","source","created_at") VALUES('5bb5033d-f585-44f0-9655-7af8ed1e3e5b','8e7776e3-e0a8-465e-b39a-c083e0c63642','大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅','反认知','婉音老师课程',1781088668827);
INSERT INTO "quotes" ("id","user_id","text","category","source","created_at") VALUES('e8fb0a1f-0297-4bd9-98f5-7283bfe4b2b9','8e7776e3-e0a8-465e-b39a-c083e0c63642','发朋友圈不是写作文，是写剧本','反认知','原创',1781088669621);
CREATE TABLE formula_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  formula_id TEXT NOT NULL,              
  variant_index INTEGER NOT NULL,        
  filled_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, formula_id, variant_index),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "formula_templates" ("id","user_id","formula_id","variant_index","filled_text","updated_at") VALUES('2ac87213-3d12-450f-999c-1be2f7e5fcb3','ed44710b-78f5-4eab-80f7-f46512ae77f8','pain',1,'你有没有：1）写稿 1 小时还没写出开头？2）发完朋友圈 5 分钟没人点赞？3）每天写 3 条却越写越没劲？',1781102572394);
INSERT INTO "formula_templates" ("id","user_id","formula_id","variant_index","filled_text","updated_at") VALUES('e737ed3d-b5f8-4e98-8b27-1e644cc364ad','ed44710b-78f5-4eab-80f7-f46512ae77f8','pain',2,'你是不是：1）加了一堆好友但没人问你产品？2）发圈发了 3 个月还是没客户？3）看着同行爆款心想''我怎么就写不出来''？',1781102582508);
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  type_colors TEXT NOT NULL,           
  updated_at INTEGER, theme_start TEXT NOT NULL DEFAULT '#667eea', theme_end TEXT NOT NULL DEFAULT '#764ba2', default_slots_per_day INTEGER NOT NULL DEFAULT 1, slot_config_json TEXT, weekday_weights_json TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "user_settings" ("user_id","type_colors","updated_at","theme_start","theme_end","default_slots_per_day","slot_config_json","weekday_weights_json") VALUES('8e7776e3-e0a8-465e-b39a-c083e0c63642','{"干货":{"bg":"#ebf4ff","fg":"#2c5282"},"生活":{"bg":"#fef5e7","fg":"#c05621"},"客户":{"bg":"#e6fffa","fg":"#234e52"},"互动":{"bg":"#faf5ff","fg":"#553c9a"},"软广":{"bg":"#fff5f5","fg":"#c53030"},"复盘":{"bg":"#f0fff4","fg":"#22543d"},"休息":{"bg":"#edf2f7","fg":"#4a5568"}}',1781177198494,'#667eea','#764ba2',4,'{"2026-06-20":["morning","evening"]}','{"early":{"干货":0.3,"复盘":0.2,"客户":0.15,"互动":0.1,"生活":0.1,"软广":0.1,"休息":0.05},"mid":{"软广":0.25,"互动":0.2,"客户":0.15,"干货":0.15,"生活":0.1,"复盘":0.1,"休息":0.05},"weekend":{"生活":0.3,"互动":0.25,"休息":0.15,"复盘":0.1,"客户":0.1,"干货":0.05,"软广":0.05}}');
INSERT INTO "user_settings" ("user_id","type_colors","updated_at","theme_start","theme_end","default_slots_per_day","slot_config_json","weekday_weights_json") VALUES('ed44710b-78f5-4eab-80f7-f46512ae77f8','{"干货":{"bg":"#ebf4ff","fg":"#2c5282"},"生活":{"bg":"#fef5e7","fg":"#c05621"},"客户":{"bg":"#e6fffa","fg":"#234e52"},"互动":{"bg":"#faf5ff","fg":"#553c9a"},"软广":{"bg":"#fff5f5","fg":"#c53030"},"复盘":{"bg":"#f0fff4","fg":"#22543d"},"休息":{"bg":"#edf2f7","fg":"#4a5568"}}',1781147542565,'#667eea','#764ba2',4,NULL,NULL);
INSERT INTO "user_settings" ("user_id","type_colors","updated_at","theme_start","theme_end","default_slots_per_day","slot_config_json","weekday_weights_json") VALUES('866080cc-89bb-4d17-8023-64dc5b98c7af','{"干货":{"bg":"#90cdf4","fg":"#1a365d"},"生活":{"bg":"#fbd38d","fg":"#7b341e"},"客户":{"bg":"#81e6d9","fg":"#1d4044"},"互动":{"bg":"#d6bcfa","fg":"#44337a"},"软广":{"bg":"#fc8181","fg":"#742a2a"},"复盘":{"bg":"#9ae6b4","fg":"#1c4532"},"休息":{"bg":"#cbd5e0","fg":"#2d3748"}}',1781160829383,'#2c3e50','#4ca1af',4,NULL,NULL);
CREATE TABLE ai_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                      
  today_type TEXT NOT NULL,                
  addon TEXT,                              
  
  draft_1 TEXT NOT NULL,
  draft_2 TEXT NOT NULL,
  draft_3 TEXT NOT NULL,
  chosen_index INTEGER,                    
  chosen_text TEXT,                        
  model TEXT,                              
  used_at INTEGER,                         
  created_at INTEGER NOT NULL, slot TEXT NOT NULL DEFAULT 'morning',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('f5f93aee-163e-4909-a3df-ded7bf620d44','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-10','干货','今天测试 AI 草稿历史',replace('<think>\nThe user wants me to write 3 WeChat Moments (朋友圈) copy candidates for "婉音老师课程体系" content marketing expert. Let me analyze the requirements:\n\n1. Today''s type: 干货 (practical/educational content)\n2. 3 candidates, separated by ---END---\n3. Each 80-200 characters\n4. First person, conversational, with "我" and "你"\n5. Should use the client case (张姐) and golden quotes from the materials\n6. The "加餐" is "今天测试 AI 草稿历史" - this seems like a topic/hook\n\nLet me think about the angles:\n\nThe "加餐" topic is "今天测试 AI 草稿历史" - this is a bit cryptic. It might mean the user is testing AI-generated drafts historically, or reviewing past AI drafts. This could be a meta moment about using AI for content creation.\n\nLet me craft 3 different angles:\n\n1. **干货型 - 配案例 (张姐的故事)**：用反认知+痛点+行动公式，结合张姐的案例\n2. **金句型 - 反认知钩子**：用"发朋友圈不是写作文，是写剧本"\n3. **互动/测试型**：结合"测试AI草稿"这个点，谈谈AI写朋友圈的局限\n\nLet me write each:\n\n**文案1: 张姐案例+反认知**\n钩子：大部分餐饮老板以为朋友圈就是发菜品图\n痛点：发了没人看/没人加微/店里越来越冷清\n行动：用剧本思维发，7天SOP+1v1钩子\n结果：30天287人加微\n\n**文案2: 金句型**\n"发朋友圈不是写作文，是写剧本"\n解释：每条文案都有角色、冲突、转折\n举例：张姐的转折\n\n**文案3: AI测试角度**\n今天测试了AI写朋友圈草稿，发现一个真相\nAI能写得像，但写不出"你"\n比如... \n\nLet me draft:\n\n**Draft 1:**\n你见过这样的餐饮老板吗？\n\n每天发9张菜品图，配上"今日特价""欢迎光临"——结果一周下来，微信没加几个人，店里越来越冷清。\n\n我学员张姐就是这样的。48岁，成都开火锅店，发了3年朋友圈，粉丝没破500。\n\n后来她改了一个动作：把"发广告"变成"写剧本"。\n\n每条朋友圈都是一个客户故事：谁来了、吃了什么、说了什么话。\n\n30天，加微287个，到店42个，营业额涨了35%。\n\n她说：原来朋友圈还能这样做。\n\n发朋友圈不是写作文，是写剧本。你的朋友圈，有剧本吗？\n\n**Draft 2:**\n今天我让AI帮我写了10条朋友圈草稿。\n\n发给我一个学员看，她秒回："太像广告了。"\n\n我懂了。\n\nAI能写出"正确"的文案，但写不出"你"。\n\n你说话的口头禅、你踩过的坑、你客户的原话——这些AI没有，你才有。\n\n所以我从来不让AI替代我写文案。\n\n我只让它帮我做一件事：检查我有没有说人话。\n\n**Draft 3:**\n大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\n什么意思？\n\n广告位只能塞信息，你看一眼就划走。\n展厅是有故事的，你愿意走进去看、停下来、还想问价。\n\n我学员张姐，把朋友圈从"广告位"改造成"展厅"后——\n30天加微287人，到店42人，营业额涨35%。\n\n她没降价、没打折、没发传单。\n\n只做了一件事：每条文案都让人想"这是谁"。\n\n你的朋友圈，是广告位，还是展厅？\n\nLet me check character counts:\n\nDraft 1: Let me count... approximately 200 chars, might be a bit long. Let me trim.\n\nActually let me recount more carefully:\n\nDraft 1:\n"你见过这样的餐饮老板吗？每天发9张菜品图，配上"今日特价""欢迎光临"——结果一周下来，微信没加几个人，店里越来越冷清。我学员张姐就是这样的。48岁，成都开火锅店，发了3年朋友圈，粉丝没破500。后来她改了一个动作：把"发广告"变成"写剧本"。每条朋友圈都是一个客户故事：谁来了、吃了什么、说了什么话。30天，加微287个，到店42个，营业额涨了35%。她说：原来朋友圈还能这样做。发朋友圈不是写作文，是写剧本。你的朋友圈，有剧本吗？"\n\nThat''s around 200 chars, within range.\n\nDraft 2: Around 150 chars, good.\n\nDraft 3: Around 180 chars, good.\n\nWait, the user said 80-180 characters. Let me recheck the rule: "每条 80-200 字" - it says 80-200 in the task section but 80-180 in the system prompt. Let me go with 80-180 to be safe, but 200 is also fine per the task.\n\nLet me also check - the user said to use 案例 and 金句 from materials. Both Draft 1 and 3 use the 张姐 case and the 金句 "发朋友圈不是写作文，是写剧本" and "朋友圈是人格的展厅". \n\nDraft 2 uses the "测试AI草稿" topic from 加餐.\n\nI think these are good. Let me finalize.\n\nOne more consideration - the user said "不强推销" (not too pushy). Let me make sure none of them feel like sales pitches. Draft 1 mentions 张姐''s results but in a storytelling way, not pushy. Draft 2 is reflective. Draft 3 is a question. Good.\n\nLet me also make sure the tone is conversational and first-person. Yes, all three have "我" and feel\n</think>','\n',char(10)),'','',2,NULL,'MiniMax-M3',1781098694401,1781098688544,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('28ae4dd6-841b-4b2d-af3b-219c016d5d85','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-10','干货','再测一次 AI 草稿历史 (D21 修复)',replace('大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\n你有没有这种感觉：每天发 3 条产品图','\n',char(10)),'','',1,replace('大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\n你有没有这种感觉：每天发 3 条产品图','\n',char(10)),'MiniMax-M3',1781098785072,1781098779582,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('fc718d75-f4a0-45d1-9789-fc766ce70713','ed44710b-78f5-4eab-80f7-f46512ae77f8','2026-06-10','休息',replace('美，不是物体本身。\n美，是人和世界关系的一种感受。\n\n/邀你共赏日落。','\n',char(10)),replace('今天给自己放了假，没接单。\n下午在阳台发了会儿呆，看光一点点从墙上挪过去。\n以前总以为美是花、是画、是很贵的远方。\n后来才慢慢明白——美，是我们愿意为某样东西停下脚步的那一刻。\n所以今天的日落，我认认真真地看了。\n你最近一次，认认真真看日落，是什么时候？','\n',char(10)),replace('休息日，不聊工作，不卷。\n想跟你分享一句今天戳到我的话：\n"美，不是物体本身，是人和世界关系的一种感受。"\n同一片晚霞，有人看到的是云，有人看到的是回家路上的那束光。\n今天我就做一件事：等日落。\n你也愿意一起，停下来五分钟吗？','\n',char(10)),replace('今天休息。\n一个人在家，听见窗外有风跑过去，出去看了一眼天。\n然后想起一句话——美，从来不是那个东西本身。\n是我愿意抬头看它的那一下，心里软了一秒。\n傍晚的天真的很好看，邀你共赏。\n不用回复，看见就行。','\n',char(10)),NULL,NULL,'MiniMax-M3',NULL,1781098991602,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('572d28de-fcf1-4fef-bdff-2c0dd9dbd3de','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','互动',NULL,replace('<think>\nThe user wants me to create 3 WeChat Moments (朋友圈) copy candidates based on the provided materials. The task type is "互动" (interactive), meaning I should focus on engagement and interaction with the audience.\n\nKey requirements:\n- 3 candidate copies, no numbering, no explanations\n- Each 80-200 characters\n- First person, conversational tone, with "I" and "you"\n- Not pushy/salesy\n- Prioritize using the client case and quotes from the materials\n- Each separated by `---END---`\n- The user is "admin", a content marketing coach specializing in WeChat Moments copywriting\n\nLet me think about what makes a good interactive post:\n- Should invite engagement\n- Could use questions, polls, or relatable scenarios\n- Use the "互动提问" formula: scenario + soul question + guide response\n\nLet me draft 3 copies:\n\n**Copy 1: Using the client case + interaction**\nI could share a relatable scenario and ask a question based on Zhang Jie''s story, inviting people to comment their own situation.\n\n**Copy 2: Using the golden quote + interaction**\n"发朋友圈不是写作文，是写剧本" - I could build a question around this.\n\n**Copy 3: Using the "大部分人以为" golden quote + interaction**\nBuild engagement around a common misconception.\n\nLet me write them:\n\n**Copy 1:**\n- Use Zhang Jie''s case as background, then ask interactive question\n- 48-year-old hotpot boss, posted food photos but no one added WeChat\n- Ask: "你发朋友圈多久了？上一次有人主动加你问产品是什么时候？"\n\n**Copy 2:**\n- Use the "剧本" golden quote\n- Ask: what''s the "plot" of your Moments?\n\n**Copy 3:**\n- Use the "人格展厅" golden quote\n- Ask people to think about their Moments as a personal exhibition\n\nLet me refine each to be 80-200 characters, natural, and interactive:\n\n**Copy 1 (案例互动):**\n我有个学员张姐，成都开火锅店的，48 岁，去年朋友圈全是菜品图，拍得挺好看，但一个月加不到 10 个人。后来她按 SOP 发，30 天加了 287 个，到店 42 个。她说了一句：原来朋友圈还能这样做。\n\n我好奇问一下你：你上次主动发朋友圈，是想"展示自己"，还是想"筛客户"？评论区聊聊👇\n\nThat''s around 130 characters, good length. Let me check... it''s conversational, has "I" and "you", uses the client case specifically, and ends with a clear interactive hook.\n\n**Copy 2 (金句互动):**\n有句话我说了好多次：发朋友圈不是写作文，是写剧本。\n\n写作文是给自己看的，写剧本是给观众看的。但我发现 90% 的人发圈还是"写作文"模式——今天吃了啥、今天好累、今天天气不错。\n\n我想问你一个事：如果你把朋友圈当成一个连续剧，你现在的"主角"是谁？是产品，还是你自己？评论区说说👇\n\nAround 140 characters, good.\n\n**Copy 3 (反认知互动):**\n大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\n广告位是"我卖什么你买什么"，展厅是"你看了觉得这个人有意思，主动想靠近"。\n\n所以我经常说：发圈先别想卖货，先想"我想让别人觉得我是一个什么样的人"。\n\n你来回答一下：你现在朋友圈里，最想让别人觉得你是什么样的人？👇\n\nAround 150 characters. Good.\n\nWait, let me re-read the requirements:\n- 每条 80-180 字 (80-180 characters, the system says, but task says 80-200)\n- Actually the system prompt says 80-180字, but the task says 80-200字. Let me aim for 120-170 to be safe.\n\nLet me also check the tone - first person, conversational, with "I" and "you", not pushy. All three look good.\n\nLet me also make sure I''m not being too salesy. The first one mentions the course indirectly through "学员张姐" and the SOP result, but the focus is on interaction. That should be fine for a "互动" type post.\n\nActually, let me reconsider copy 1. It mentions specific numbers (287, 42, 35%) which feels a bit promotional. For an "互动" type, maybe I should make it more about the question and less about the results. But the brief says I can use the client case. Let me keep it but make the question the focus.\n\nLet me finalize:\n\n**Copy 1:**\n我有个学员张姐，48 岁，成都开火锅店的。她之前朋友圈全是菜品图，拍得也挺用心，但一个月加不到 10 个人。后来调整发圈方式，30 天加了 287 个。\n\n你看，同样是发圈，差别这么大。\n\n我想问你：你上次发朋友圈，是想"记录一下"，还是想"筛客户进来"？评论区说说你的答案👇\n\nAround 140 chars. Good, natural, interactive.\n\n**Copy 2:**\n"发朋友圈不是写作文，是写剧本。"\n\n这句话我说了不下 100 次，但发现 90% 的人还是按"写作文"模式在发——今天吃了啥，今天好累，今天好忙。\n\n作文是给自己存档的，剧本是给观众追的。\n\n我想知道你：你觉得你现在发圈，是在"写作文"还是"写剧本"？自评一下👇\n\nAround 130 chars. Good.\n\n**Copy 3:**\n大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\n广告位是"我卖啥你买啥"，展厅是"你看了觉得这个人有意思，主动想靠近"。\n\n所以发圈前别急着卖货，先想一件事：\n\n如果陌生人翻你\n</think>','\n',char(10)),'','',NULL,NULL,'MiniMax-M3',NULL,1781150715813,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('2c1931e9-2265-4ea3-8896-82ea95417dae','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','互动',NULL,replace('<think>\nThe user wants me to write 3 WeChat Moments (朋友圈) copy options for a content marketing coach named "admin" who specializes in 朋友圈文案 (WeChat Moments copywriting) and 朋友圈成交 (converting through Moments). Today''s task type is "互动" (interactive).\n\nKey requirements:\n- First person, conversational, has "我" and "你"\n- Not pushy sales\n- Use the client case (张姐, Chengdu hotpot restaurant, 48 years old) and the golden quotes\n- Interactive style\n- 80-200 characters each\n- No numbering, no headers, no "以下是"\n- Each separated by ---END---\n\nLet me think about the "互动" (interactive) angle. This means I should ask questions to engage the audience, invite responses, create dialogue.\n\nLet me use Formula 7 (互动提问) and Formula 2 (痛点具象化) primarily, with some elements of Formula 1 (反认知).\n\nLet me draft 3 options:\n\nOption 1: Use the 张姐 case + interactive question\nHook into the interactive element - ask about their own experience with 发朋友圈\n\nOption 2: Use golden quote "发朋友圈不是写作文，是写剧本" + interactive\n\nOption 3: Pain point visualization + interactive question\n\nLet me write them:\n\n1. Interactive question about 朋友圈 struggles\n你有没有这种感觉：发朋友圈之前想了半小时，发出去3分钟没人看，删了又可惜？\n我以前也是这样。直到有个做火锅的张姐告诉我：不是你的产品没吸引力，是你的朋友圈没人格。\n我让她试了一个方法——把"卖火锅"变成"卖老板娘的故事"，30天加了287个微信。\n你想不想知道她具体怎么发的？评论区扣"火锅"，我发你看看。\n\n2. Golden quote + interactive\n"发朋友圈不是写作文，是写剧本。"\n这句话我说了8年，今天想问你：你最近一条朋友圈，是写给谁看的？\n是写给客户的？还是写给自己的？还是……根本不知道写给谁？\n我带过的100+老板里，90%都是第三种。剧本没主角，观众当然不买票。\n你现在那条朋友圈，主角是谁？评论区告诉我，我帮你看看。\n\n3. Pain point + interactive\n你有没有——\n发了一堆产品图，没人点赞？\n写了走心文案，没人咨询？\n每天纠结要不要发，发了又焦虑？\n如果三条都中了，说明你把朋友圈当广告位了。其实它是人格的展厅，卖的是"你这个人"。\n我的学员张姐，做了10年火锅，去年开始按人格去发朋友圈，30天到店42个。\n你现在最想解决哪一条？留言给我，我挑几个下条朋友圈拆给你看。\n\nLet me count characters and refine:\n\nOption 1: 感觉有点长, let me check... about 180 characters, that''s fine within 80-200.\n\nOption 2: about 160 characters, good.\n\nOption 3: about 190 characters, within range.\n\nLet me refine them to be more natural and conversational:\n\n1. 互动式 - 痛点场景 + 案例 + 互动引导\n你有没有这种感觉：发朋友圈之前纠结半小时，发出去3分钟没人看，删了又可惜？\n以前我也这样。后来做火锅的张姐跟我说了一句扎心的话：不是你产品不好，是朋友圈没人格。\n后来她按"剧本"发，不卖火锅、卖老板娘的故事，30天加了287个微信、到店42个。\n你也想试试吗？评论区扣"想看"，我下条拆给你。\n\n2. 金句钩子 + 互动提问\n"发朋友圈不是写作文，是写剧本。"\n我说了8年这句话，今天想问你——你最近一条朋友圈，主角是谁？\n卖产品？讲心情？还是自己都不知道在给谁看？\n我带过的100多位老板，90%都是第三种。剧本没有主角，观众当然不买票。\n你那条朋友圈的主角，评论区告诉我，我帮你看。\n\n3. 痛点具象化 + 互动\n你朋友圈是不是也这样：\n- 一堆产品图，点赞个位数\n- 想写走心点，又怕掉粉\n- 发完就想看数据，焦虑得不行\n\n三条都中？那你真该听听张姐的故事。\n一个48岁的成都火锅老板娘，朋友圈从"卖锅底"变成"卖自己"，30天到店42个、营收涨35%。\n\n差别在哪？评论区聊聊你的卡点，我下条朋友圈挑几个拆给你看。\n\nThese look good. Let me finalize them.\n\nActually, I need to make sure the tone is like the user (admin) speaking, first person, conversational. Let me also make sure I''m not being too salesy.\n\nLet me also think about whether the emoji or special characters would work - I think for 朋友圈, simple punctuation is better.\n\nFinal versions:\n\n1. 你有没有这种感觉：发朋友圈之前纠结半小时，发出去3分钟没人看，删了又可惜？\n以前我也这样。后来一个做火锅的张姐跟我说了一句扎心的话：不是你产品不好，是朋友圈没人格。\n她后来按"剧本"发，不卖锅底、卖老板娘的故事，30天加了287个微信、到店42个。\n你也想试试吗？评论区扣"想看"，我下条拆给你。\n\n2. "发朋友圈不是写作文，是写剧本。"\n这句话我说了8年，今天想问你——你最近一条朋友圈，主角是谁？\n是卖产品？讲心情？还是自己都不知道写给谁？\n我带过的100多位老板里，90%都是第三种。剧本没主角，观众当然不买票。\n你那条朋友圈的主角是谁？评论区告诉我，我帮你看看。\n\n3. 你朋友圈是不是也这样：\n发了一堆产品图，点赞个位数\n想走心写点啥，又怕掉粉\n发完就盯着数据，越看越焦虑\n\n三条都中？真该听听张姐的故事——\n</think>','\n',char(10)),'','',NULL,NULL,'MiniMax-M3',NULL,1781151135337,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('afe1d1f0-fe52-4835-8564-8c66f42d5380','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','干货',NULL,replace('大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n你天天发产品图、报价单、促销信息，客户刷到只会划走——因为没人想看广告。\n但你发你的审美、你的态度、你帮客户解决问题的过程，人格出来了，客户自然想靠近。\n今天分享一个我自己用 8 年的判断标准：每条朋友圈发之前问自己一句，这条是在"卖东西"，还是在"让人懂我"？\n卖东西的删掉，让人懂你的，留下。\n记住，朋友圈成交的第一步，从来不是产品，是先让客户喜欢上你这个"人"。\n---','\n',char(10)),'','',NULL,NULL,'MiniMax-M3',NULL,1781167569845,'morning');
INSERT INTO "ai_drafts" ("id","user_id","date","today_type","addon","draft_1","draft_2","draft_3","chosen_index","chosen_text","model","used_at","created_at","slot") VALUES('e544510a-8648-4e20-aa3e-2bf8361fd0da','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','干货',NULL,replace('<think>\nThe user wants me to write 3 WeChat Moments (朋友圈) copy candidates in the style of a content marketing coach called "admin" who has 8 years of experience focusing on WeChat Moments conversion. Today''s type is 干货 (practical/tips content), weekly theme is 反认知 (counter-intuitive), month stage is 破冰 (ice-breaking).\n\nKey elements to use:\n- 金句: "发朋友圈不是写作文，是写剧本" [counter-intuitive]\n- 金句: "大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅" [counter-intuitive]\n- Client case: 张姐 (Chengdu hotpot restaurant owner, 48) - went from posting food photos with no results to getting 287 WeChat contacts and 42 in-store visits in 30 days, revenue up 35%\n- Formula to prioritize: 反认知+痛点+行动, 客户证言, 金句钩子\n- 7 dimensions suggested: 生活(0), 思想(0) - should lean into these\n\nRequirements:\n- 80-200 characters each\n- First person, conversational, has "我" and "你"\n- Not pushy/salesy\n- No numbering, no preamble\n- Separated by ---END---\n\nLet me craft 3 posts:\n\nPost 1: Use the counter-intuitive hook + 张姐''s case (client testimonial formula)\nTopic: 朋友圈不是广告位，是人格展厅 + integrate 张姐''s story\n\nPost 2: Use the "发朋友圈不是写作文，是写剧本" hook + practical insight (干货)\nTopic: Reframing what moments posting means\n\nPost 3: Counter-intuitive + 痛点具象化 or 思想维度\nTopic: A thought piece that challenges conventional wisdom\n\nLet me write them now, making sure each is 80-200 characters, conversational, with "我" and "你".\n\nDraft 1:\n你有没有这种感觉？每天发3条朋友圈，菜品图、活动图、好评截图轮番上，结果加微信的人还是个位数。\n\n我有个学员张姐，在成都开火锅店，48岁，之前就是这样。学了朋友圈文案课后，我让她别再硬广，改成"7天发圈剧本"：第一条讲自己为什么开这家店，第三条晒后厨真实场景，第五条抛一个钩子"想看我私藏的蘸料配方吗？评论区扣1"。\n\n30天，加了287个微信，到店42个，营业额涨了35%。\n\n大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。你发的不是产品，是"你是谁"。\n\nLet me count: This might be over 200. Let me trim.\n\n实际上让我重写，更紧凑一些。\n\nDraft 1 (revised):\n你每天发3条朋友圈，菜品图、活动图轮番上，加微信的人还是个位数，对不对？\n\n我学员张姐，48岁，成都开火锅店的，之前也这样。学了文案课后我让她别硬广，改"7天发圈剧本"：第一条讲自己为啥开店，第三条晒后厨，第五条抛钩子"想看我私藏蘸料？扣1"。\n\n30天，加微287个，到店42个，营业额涨35%。\n\n大部分人以为朋友圈是广告位，其实朋友圈是人格的展厅。\n\nCount: roughly 170 characters, good.\n\nDraft 2 (干货 with 金句):\n干了一行你就知道：发朋友圈不是写作文，是写剧本。\n\n写作文是给自己看，写剧本是给观众看。\n\n区别在哪？作文讲究"我想表达什么"，剧本讲究"我看完会有什么反应"。\n\n所以你每发一条之前，先问自己3个问题：\n1）刷到这条的人，会停留几秒？\n2）看完他想点赞还是想划走？\n3）他能不能从这条里，记住我是个怎样的人？\n\n想清楚这三点，你的每一条朋友圈才不是废话。\n\nCount: around 190, good.\n\nDraft 3 (思想维度 + 反认知):\n我做内容营销8年，见过太多老板把朋友圈当"任务"：今天必须发3条，那就凑3条。\n\n发完自己都不想看，更别说客户了。\n\n但你发现没？那些靠朋友圈持续接单的人，从不"凑"内容。她们发得不多，但每一条都像在跟一个老朋友聊天。\n\n区别不是勤奋，是思维。\n\n你把朋友圈当"任务栏"，它就是负担；你把它当"关系场"，它就是自动成交机器。\n\n怎么切换？下次想发之前，先想想：这条话，我面对面会跟朋友说吗？\n\nCount: around 190, good.\n\nLet me review all three:\n1. Uses 张姐''s case + "人格展厅"金句 - good for 客户证言 + 反认知\n2. Uses "写作文是写剧本"金句 + 干货 action steps - 干货 type\n3. 思想维度 + 反认知 - covers the suggested dimension\n\nAll have "我" and "你", conversational, no hard sell. Let me finalize.\n\nWait, I need to check character count more carefully. The user said 80-180字 in the system prompt but 80-200字 in the task description. Let me aim for 80-180 to be safe.\n\nLet me also check - the system prompt says "不要编号标题", so no numbers like 1) 2) 3) in the posts. Let me remove those numbers in Draft 2.\n\nRevised Draft 2:\n干了一行你就知道：发朋友圈不是写作文，是写剧本。\n\n写作文是给自己看，写剧本是给观众看。\n\n区别在哪？作文讲究"我想表达什么"，剧本讲究"我看完会有什么反应"。\n\n所以你每发一条之前，先问自己三个问题：刷到这条的人，会停留几秒？看完他想点赞\n</think>','\n',char(10)),'','',NULL,NULL,'MiniMax-M3',NULL,1781167615141,'morning');
CREATE TABLE weekly_summaries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,             
  week_end TEXT NOT NULL,               
  posted_count INTEGER NOT NULL DEFAULT 0,    
  skipped_count INTEGER NOT NULL DEFAULT 0,   
  pending_count INTEGER NOT NULL DEFAULT 0,   
  type_breakdown TEXT NOT NULL DEFAULT '{}',  
  slot_breakdown TEXT NOT NULL DEFAULT '{}',  
  summary_text TEXT,                    
  generated_at INTEGER NOT NULL,
  UNIQUE(user_id, week_start),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "weekly_summaries" ("id","user_id","week_start","week_end","posted_count","skipped_count","pending_count","type_breakdown","slot_breakdown","summary_text","generated_at") VALUES('56fe2f1f-2d7b-4154-883f-09b630992f9d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-08','2026-06-14',1,0,16,'{"客户":1,"互动":4,"软广":4,"复盘":4,"休息":4}','{"morning":5,"evening":4,"night":4,"noon":4}','📊 本周（2026-06-08 - 2026-06-14）发朋友圈 1 条 · 待发 16 条 · 分段：早 8=5 / 午 12:30=4 / 晚 20=4 / 夜 22:30=4 · 类型：互动 4 / 软广 4 / 复盘 4 / 休息 4 / 客户 1',1781147445012);
CREATE TABLE theme_months (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year_month TEXT NOT NULL,             
  theme TEXT NOT NULL,                  
  weights_json TEXT NOT NULL,           
  custom_label TEXT,                    
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, cycle_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, year_month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "theme_months" ("id","user_id","year_month","theme","weights_json","custom_label","created_at","updated_at","cycle_index") VALUES('9857cc83-c9c1-4b18-ac53-c180b3117175','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06','trust','{"干货":0.1,"生活":0.1,"客户":0.3,"互动":0.2,"软广":0.1,"复盘":0.15,"休息":0.05}',NULL,1781147487500,1781147487500,0);
CREATE TABLE weekly_themes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  theme TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, week_start),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "schedule" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,                    
  slot TEXT NOT NULL DEFAULT 'morning',  
  post_type TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, 
  updated_at INTEGER,
  UNIQUE(user_id, date, slot, sort_order),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('9e111dbf-f13d-419c-8059-b1d26107e87b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-10','morning','客户','testimonial','posted',NULL,0,1781100668664);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('188fb622-1af1-4b22-8040-ebb601037fe7','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','morning','生活','lifestyle','skipped',NULL,0,1781179464047);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('e590a7aa-d5e2-4b77-adf9-cc548c15ac91','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-12','morning','软广','softad','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('592d6e41-f577-4ae4-9112-fc2acf7e38a3','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-13','morning','复盘','review','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('0fd80822-d9db-4697-ac74-558295e8c114','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-14','morning','复盘','review','pending','📊 本周（2026-06-08 - 2026-06-14）发朋友圈 1 条 · 待发 16 条 · 分段：早 8=5 / 午 12:30=4 / 晚 20=4 / 夜 22:30=4 · 类型：互动 4 / 软广 4 / 复盘 4 / 休息 4 / 客户 1',0,1781147445012);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('18c27914-b1df-40ce-935f-1f03fe4f91b4','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-15','morning','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('b435628f-9c08-4e93-a609-03101f2ef2b5','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-16','morning','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('277830dc-d741-4867-8846-324c8124eb4d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-17','morning','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('28f0dc9a-0484-4f41-bcb2-8ad61fcc7f8a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-18','morning','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('02efc6c2-76fc-40a2-91d0-a1f72750fc76','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-19','morning','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('bd924560-c755-49da-b3f5-a16890258a1a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-20','morning','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('9e2e943c-dd68-4fb0-b572-6dac8782bfea','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-21','morning','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('fe45faa2-7e4a-4c61-8c0a-bd2fcb815738','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-22','morning','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6172a069-dfed-4813-89f8-173d4f99621f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-23','morning','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('64219fb1-0b4b-404d-b8dd-ae0f7c6ff1ab','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-24','morning','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('2f79dbf5-a7a0-46ed-9bcb-bbc6c36b80e3','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-25','morning','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('297c10d5-2d77-46e0-94af-32192e2ae2ae','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-26','morning','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('aa0a10d0-cdef-4ff4-a428-9a06be41042f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-27','morning','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('5eb31aae-79e4-44a0-83f0-6c6b5b1651e4','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-28','morning','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('5374595e-3091-4fc6-b4d8-3fa6e8c696a8','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-29','morning','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('0391db12-3dd6-4e2b-9a90-e3e187dfe40b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-30','morning','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('bd44acb3-e366-4daf-b2d0-467e257e11cd','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-01','morning','客户','testimonial','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('14469974-ee8c-4b41-95c7-ddd74d2074f5','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-02','morning','互动','ask','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('7bf292f6-f9d8-4594-b720-edf7ca95e625','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-03','morning','软广','softad','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('cb5096f1-46ef-4986-8304-6a2a04a7dd4a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-04','morning','复盘','review','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('b874c8f9-7e96-4c3a-bff4-1977ed638a84','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-05','morning','休息','lifestyle','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('595878d2-60dd-4cbf-8887-b113f8fd813f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-06','morning','干货','pro','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('a1fac1f2-73c7-40c4-bdee-7f9c920a5e95','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-07','morning','生活','lifestyle','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('37844dca-6b52-4f48-89fb-c97385a88fab','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-08','morning','客户','testimonial','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('9c9c5db1-3b17-450e-b34d-bebc5b98da21','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-09','morning','互动','ask','pending',NULL,0,1781088593881);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('3a6ebd72-2212-41b8-9175-69247ae61467','ed44710b-78f5-4eab-80f7-f46512ae77f8','2026-06-10','morning','休息','lifestyle','posted',replace(replace('美，不是物体本身。\r\n美，是人和世界关系的一种感受。\r\n\r\n/邀你共赏日落。','\r',char(13)),'\n',char(10)),0,1781099852911);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f3f44d7e-59aa-4b47-b9c7-02053b2cd0fd','866080cc-89bb-4d17-8023-64dc5b98c7af','2026-06-25','morning','客户','testimonial','pending',NULL,0,1781101733364);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('ac883b31-9050-4d8c-8bfe-a89764759952','866080cc-89bb-4d17-8023-64dc5b98c7af','2026-06-10','morning','干货','pro','pending',NULL,0,1781103720764);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('cca0e988-08c5-401d-a3e5-87faa1e6d4a5','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-15','noon','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('d8c63eca-7ff3-41af-a236-6fcd24dc2a23','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-15','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('3318698a-4103-414e-991b-32c3f59d9910','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-15','night','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('41fabae3-8d1f-49b8-acc0-89b3a69ed72c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','noon','生活','lifestyle','pending',NULL,0,1781179464047);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('66224e17-9fa4-4d72-8227-61d7d4aebf63','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','evening','生活','lifestyle','pending',NULL,0,1781179464047);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('07287370-3843-42dc-8a64-140ee8ab6f9a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','night','软广','softad','pending',NULL,0,1781179464047);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('ff2623e9-c59e-4060-a1c6-2f716dc0bf73','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-12','noon','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('c80a3531-f1d3-482e-94f5-7625dce33888','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-12','evening','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('28daefd5-6788-4512-9a5e-70f0e9e32c1d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-12','night','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('58a93018-c48d-4253-8853-3fb80af8dc3c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-13','noon','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('30a97e2e-b287-4eda-aefe-20b5ced36d3a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-13','evening','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('a2dd0b4c-720e-4b6e-888d-c7ac41d87203','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-13','night','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6d42d7b8-8637-4076-ab5e-cf0b6a1b5491','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-14','noon','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('7d412775-c805-4cc2-8733-e1b8676eac1d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-14','evening','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('a30f87b7-8ba1-42f1-944f-5db8669f506f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-14','night','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('0a6d895c-6423-4dbc-af6e-9a803197c85c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-16','noon','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('065494a9-d4d7-4a00-b9fc-e8713cab10c6','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-16','evening','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('509fd122-185c-40d3-b39e-33875db2e075','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-16','night','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('59f5bf78-f203-4593-9d07-cc9fc1ef1480','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-17','noon','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('084ae17d-7746-48e5-a81b-6b22e5bf346f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-17','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6d96af96-8b7e-4bb5-b44b-7fdc0c6509ca','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-17','night','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('15db1a0f-0fe1-46e3-8712-4617ed0d014b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-18','noon','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('43f459f5-ba76-40e2-8bbc-a2398c1584c9','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-18','evening','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('154c6f79-abdf-4a3d-a65f-346fc90c539d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-18','night','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f9eefff8-7a35-4739-bf1f-45522ba60b69','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-19','noon','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('82cdd5e1-87cd-49f1-83c7-e0c2dc72d59b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-19','evening','软广','softad','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f5583fe4-66e0-47a2-96dd-1d6ae9c07a16','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-19','night','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('321b976d-d897-45ba-a3de-99329f332aea','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-20','noon','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('02a6283f-ee8f-4c6e-801e-1e0544dde00d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-20','evening','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('d97a32cd-e062-42da-a5eb-5b1ca8edbf98','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-20','night','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('46931220-12dd-42ed-8036-26c105a28003','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-21','noon','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('016e732d-4764-4a0e-b84e-221d4486e538','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-21','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('dd377ca7-d6ad-4590-bfcb-1cdb490acc26','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-21','night','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('5f0d01c5-bb28-4571-8527-cf4b415e1be7','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-22','noon','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('e67c5306-9ab9-4365-a504-5324b5de4eff','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-22','evening','软广','softad','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('06b0a4f8-c66d-426a-bca5-8265937bfca0','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-22','night','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('c7c6242b-77a5-4f3b-96d2-c2dc1f03894f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-23','noon','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('aa8a34c8-d28a-4b8e-b1c4-26dc301685c5','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-23','evening','软广','softad','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('1cf79204-7de3-4f6d-a4df-b74445676fb7','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-23','night','休息','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('e546cdb1-3741-49f7-b9a6-61a5ce3158f6','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-24','noon','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('aeb3f880-c62e-4201-9d4a-b51b7cdeddea','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-24','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('ace9164d-12eb-459f-a9fb-ae69f2cb5294','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-24','night','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('72019779-4bb5-418d-b6e5-d57bf7b6d804','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-25','noon','软广','softad','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f31aba43-4108-43a9-a139-07bfe7408b24','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-25','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('dd9f36e3-f6d0-4c77-ba20-c66a7e6f169c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-25','night','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('7be57230-4f7b-4ee6-bdfb-3837850e7b9b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-26','noon','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f37f82b4-b638-43e5-beb9-2b7fdb92e7a2','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-26','evening','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('4a547a7e-0c13-4788-91fb-dc20f74762a1','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-26','night','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('64a2e6a3-03f0-4198-952e-a0d273f79c62','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-27','noon','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('47803e58-bf48-4ea8-8c2a-2eb79648efdd','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-27','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('22aff742-6cc3-45d5-87c2-f952817b361c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-27','night','复盘','review','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('5f440137-78d0-4d69-8aff-52615a23a374','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-28','noon','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('676df630-4b29-4a5f-9cd8-bc612b5b0f32','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-28','evening','休息','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('aca6bfae-4bb3-4035-8e4d-7c6fe504e713','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-28','night','互动','ask','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('4122a65c-d537-4031-8871-27e17c549bad','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-29','noon','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('960b58ca-21fa-4907-bbb6-bc2d20c3fbef','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-29','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('546a0c65-a8a9-42d4-87b9-9b5e504ebb97','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-29','night','软广','softad','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('492dbe29-0f2d-49e0-9b67-0f118e27ef63','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-30','noon','生活','lifestyle','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('b4804f4e-665f-4bae-a20c-7b3ef4acfaea','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-30','evening','客户','testimonial','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6afc255e-848f-48c6-9665-8dfb64a04b73','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-30','night','干货','pro','pending',NULL,0,1781151508453);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('8ca96269-88c9-469a-883a-26c42288f4bd','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-01','noon','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('0a702462-69e4-4f5e-b7cd-6a3467d90f3b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-01','evening','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('3d7e3236-7a00-49eb-94f0-c509d303f9c9','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-01','night','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('c1f384e1-7b88-4f41-8c70-2abed600b4e2','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-02','noon','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('60098a2b-9853-4f0e-b2c9-6db6fed2dde0','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-02','evening','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('033167db-4a18-4a90-9c21-c8e228051027','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-02','night','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('83b02e79-88ff-4faa-8c2d-99b6c974c3b9','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-03','noon','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('d68cb148-40f6-4ca8-9b35-f1cd14999b7f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-03','evening','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f1526bf2-81f1-4f72-b95a-c2d91d4b4bcf','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-03','night','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('d0abac6c-b197-4dba-95f9-d792bd01b076','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-04','noon','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('523a111c-d410-4ee6-b922-bd0f4d765a6c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-04','evening','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('807a9693-0781-4d4b-83ba-0d29bb402c7d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-04','night','复盘','review','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('674f5520-671e-4ffb-b69b-e78964ddb7dd','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-05','noon','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('995977d4-d186-49df-85c5-204c60e2800b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-05','evening','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('c616ca23-956b-4b3a-819d-3d54d37d8a4b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-05','night','休息','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('12eee14b-f5b9-4268-96c2-c3daa39490e3','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-06','noon','干货','pro','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('aac6b2cc-b0d0-40be-bb7f-04e893c6012f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-06','evening','干货','pro','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('48102557-9154-46e2-a69c-e0ce53c60fec','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-06','night','干货','pro','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('2a471d4c-562f-426c-ae55-e4647b686e7c','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-07','noon','生活','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('59657c8f-eb34-40f4-8b25-8f8129b29f1b','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-07','evening','生活','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('1c57d65c-3db2-4dba-af2d-3a253438612a','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-07','night','生活','lifestyle','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6954ff6b-62a4-4f4b-8388-e32ec4dc7c02','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-08','noon','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('e907004f-2270-4f9d-aa40-dd9842c4c24d','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-08','evening','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f9837919-45b7-46ca-a588-38298e8f9d53','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-08','night','客户','testimonial','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('d54a9612-e904-4d6b-ba5f-a1294fb4dd20','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-09','noon','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('524535b6-f3f7-4a09-b2c5-1cc67f878248','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-09','evening','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('05fb84f9-0086-44ff-8e94-fe86dc296c9e','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-09','night','互动','ask','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('806c993a-ba5c-4a51-a260-7c4b8ae5dc02','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-10','morning','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('fbb6c016-71b6-4c34-941e-d711247b73cb','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-10','noon','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('6a4776d0-fa96-4135-a4dd-539490a721ec','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-10','evening','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('40b9c4b3-3a7d-4ebb-af95-dcefbe6f9f94','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-07-10','night','软广','softad','pending',NULL,0,1781146095614);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('4f1543b8-e954-464a-a328-221d12922067','ed44710b-78f5-4eab-80f7-f46512ae77f8','2026-06-11','morning','休息','lifestyle','pending',NULL,0,1781146936117);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('f0fab3bc-59ae-445b-b721-8c0477196c65','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','morning','复盘','review','pending','加量: 干货',1,1781175449910);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('88077790-ec19-46ca-b7d5-25c519a4bf7f','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','noon','客户','testimonial','pending',NULL,1,1781179464047);
INSERT INTO "schedule" ("id","user_id","date","slot","post_type","template_id","status","note","sort_order","updated_at") VALUES('18e99055-3d02-4f22-8999-36e38af9c969','8e7776e3-e0a8-465e-b39a-c083e0c63642','2026-06-11','evening','复盘','review','pending',NULL,1,1781179464047);
CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,             -- 8 位 base36（例 "K7XQ4M2P"）
  created_by TEXT NOT NULL,              -- admin user_id
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,                    -- nullable（ms epoch）
  note TEXT,                             -- admin 备注
  is_active INTEGER NOT NULL DEFAULT 1,  -- 0 = 已撤销
  created_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO "invite_codes" ("id","code","created_by","max_uses","used_count","expires_at","note","is_active","created_at") VALUES('ed9a1a0d-5d99-4ad3-bc41-c01dd5fd37a1','EWYZARGK','8e7776e3-e0a8-465e-b39a-c083e0c63642',1,0,NULL,NULL,1,1781191476251);
CREATE TABLE invite_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redeemed_at INTEGER NOT NULL,
  UNIQUE(code_id, user_id),
  FOREIGN KEY (code_id) REFERENCES invite_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',9);
CREATE INDEX idx_intros_user ON intros(user_id);
CREATE INDEX idx_cases_user ON cases(user_id);
CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_formulas_user ON formula_templates(user_id);
CREATE INDEX idx_ai_drafts_user_date_slot ON ai_drafts(user_id, date, slot);
CREATE INDEX idx_weekly_summaries_user ON weekly_summaries(user_id);
CREATE INDEX idx_weekly_summaries_user_week ON weekly_summaries(user_id, week_start DESC);
CREATE INDEX idx_theme_months_user ON theme_months(user_id);
CREATE INDEX idx_theme_months_user_month ON theme_months(user_id, year_month DESC);
CREATE INDEX idx_weekly_themes_user ON weekly_themes(user_id);
CREATE INDEX idx_weekly_themes_user_week ON weekly_themes(user_id, week_start DESC);
CREATE INDEX idx_schedule_user_date ON schedule(user_id, date);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_active ON invite_codes(is_active, created_at);
CREATE INDEX idx_invite_redemptions_code ON invite_redemptions(code_id);
CREATE INDEX idx_invite_redemptions_user ON invite_redemptions(user_id);
