-- HYRO FORGE: Social Studies Curriculum
-- Migration 031: Utah Social Studies Graduation Requirements (3.0 credits)
-- Covers: World Geography, World History, US History, US Government/Civics
-- Design Philosophy: Pattern recognition, systems thinking, NOT memorization
-- Focus: Understanding how societies work, historical patterns, civic engagement

-- ============================================================================
-- WORLD GEOGRAPHY STANDARDS (SS.GEO) - 0.5 credits
-- Understanding spatial patterns, human-environment interaction, globalization
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Physical Geography
  ('ss_geo_1', 'social_studies', 'utah_core', 'SS.GEO.1', 'Physical Geography Fundamentals', 'Understand Earth''s physical features, climate zones, and natural processes that shape landscapes.', NULL, 'middle', 'World Geography', 'Physical Geography', 10, 1),
  ('ss_geo_2', 'social_studies', 'utah_core', 'SS.GEO.2', 'Human-Environment Interaction', 'Analyze how humans adapt to, modify, and depend on their physical environment.', NULL, 'middle', 'World Geography', 'Physical Geography', 11, 1),
  ('ss_geo_3', 'social_studies', 'utah_core', 'SS.GEO.3', 'Maps and Spatial Thinking', 'Interpret maps, geographic data, and spatial relationships to understand patterns.', NULL, 'middle', 'World Geography', 'Spatial Analysis', 12, 1),

  -- Human Geography
  ('ss_geo_4', 'social_studies', 'utah_core', 'SS.GEO.4', 'Climate and Culture', 'Examine how climate influences cultural development, settlement patterns, and economic activities.', NULL, 'middle', 'World Geography', 'Human Geography', 13, 1),
  ('ss_geo_5', 'social_studies', 'utah_core', 'SS.GEO.5', 'Resources and Conflict', 'Analyze how natural resources drive economic development and international conflict.', NULL, 'middle', 'World Geography', 'Human Geography', 14, 1),
  ('ss_geo_6', 'social_studies', 'utah_core', 'SS.GEO.6', 'Globalization Patterns', 'Understand interconnectedness of global economies, cultures, and environmental systems.', NULL, 'middle', 'World Geography', 'Global Systems', 15, 1),
  ('ss_geo_7', 'social_studies', 'utah_core', 'SS.GEO.7', 'Population and Migration', 'Analyze patterns of human population distribution, urbanization, and migration.', NULL, 'middle', 'World Geography', 'Human Geography', 16, 1),
  ('ss_geo_8', 'social_studies', 'utah_core', 'SS.GEO.8', 'Economic Geography', 'Understand spatial patterns of economic activity and trade networks.', NULL, 'middle', 'World Geography', 'Global Systems', 17, 1);

-- ============================================================================
-- WORLD HISTORY PATTERNS STANDARDS (SS.WHI) - 1.0 credit
-- Understanding civilizational cycles, technological change, global connections
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Civilizational Patterns
  ('ss_whi_1', 'social_studies', 'utah_core', 'SS.WHI.1', 'Rise and Fall of Civilizations', 'Identify patterns in how civilizations emerge, grow, peak, and decline.', NULL, 'middle', 'World History', 'Civilizational Patterns', 20, 1),
  ('ss_whi_2', 'social_studies', 'utah_core', 'SS.WHI.2', 'Agricultural Revolution', 'Understand how agriculture transformed human societies and enabled civilization.', NULL, 'middle', 'World History', 'Transformations', 21, 1),
  ('ss_whi_3', 'social_studies', 'utah_core', 'SS.WHI.3', 'Trade Route Networks', 'Analyze how trade routes (Silk Road, etc.) connected civilizations and spread ideas.', NULL, 'middle', 'World History', 'Global Connections', 22, 1),

  -- Modern Transformations
  ('ss_whi_4', 'social_studies', 'utah_core', 'SS.WHI.4', 'Industrial Revolution', 'Examine how industrialization transformed economies, societies, and power structures.', NULL, 'middle', 'World History', 'Transformations', 23, 1),
  ('ss_whi_5', 'social_studies', 'utah_core', 'SS.WHI.5', 'Colonialism and Effects', 'Analyze European colonialism and its lasting impacts on global power and culture.', NULL, 'middle', 'World History', 'Global Power', 24, 1),
  ('ss_whi_6', 'social_studies', 'utah_core', 'SS.WHI.6', '20th Century Transformations', 'Understand world wars, ideological conflicts, and decolonization movements.', NULL, 'middle', 'World History', 'Modern Era', 25, 1),
  ('ss_whi_7', 'social_studies', 'utah_core', 'SS.WHI.7', 'Technology and Social Change', 'Examine how technological innovations drive social, economic, and political change.', NULL, 'middle', 'World History', 'Transformations', 26, 1),
  ('ss_whi_8', 'social_studies', 'utah_core', 'SS.WHI.8', 'Religious and Philosophical Systems', 'Understand major world religions and philosophies as organizing systems for societies.', NULL, 'middle', 'World History', 'Cultural Systems', 27, 1),
  ('ss_whi_9', 'social_studies', 'utah_core', 'SS.WHI.9', 'Revolutions and Reform', 'Analyze patterns in revolutionary movements and social reform across time.', NULL, 'middle', 'World History', 'Social Change', 28, 1),
  ('ss_whi_10', 'social_studies', 'utah_core', 'SS.WHI.10', 'Empire Building Patterns', 'Compare strategies of empire building and reasons empires collapse.', NULL, 'middle', 'World History', 'Civilizational Patterns', 29, 1);

-- ============================================================================
-- US HISTORY PATTERNS STANDARDS (SS.USH) - 1.0 credit
-- Understanding American development, expansion, conflicts, and transformations
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Founding and Early Republic
  ('ss_ush_1', 'social_studies', 'utah_core', 'SS.USH.1', 'Founding Principles', 'Understand Enlightenment ideas that shaped American founding documents and governance.', NULL, 'middle', 'US History', 'Founding Era', 30, 1),
  ('ss_ush_2', 'social_studies', 'utah_core', 'SS.USH.2', 'Constitutional Development', 'Analyze how the Constitution has evolved through amendments and interpretation.', NULL, 'middle', 'US History', 'Founding Era', 31, 1),
  ('ss_ush_3', 'social_studies', 'utah_core', 'SS.USH.3', 'Expansion and Manifest Destiny', 'Examine westward expansion, its motivations, and impacts on indigenous peoples.', NULL, 'middle', 'US History', 'Expansion', 32, 1),

  -- Conflict and Division
  ('ss_ush_4', 'social_studies', 'utah_core', 'SS.USH.4', 'Slavery and Sectionalism', 'Understand how slavery created sectional tensions leading to Civil War.', NULL, 'middle', 'US History', 'Conflict', 33, 1),
  ('ss_ush_5', 'social_studies', 'utah_core', 'SS.USH.5', 'Civil War and Reconstruction', 'Analyze the Civil War, emancipation, and failed promises of Reconstruction.', NULL, 'middle', 'US History', 'Conflict', 34, 1),

  -- Industrial America
  ('ss_ush_6', 'social_studies', 'utah_core', 'SS.USH.6', 'Industrial Age Transformation', 'Examine how industrialization changed American economy, cities, and labor.', NULL, 'middle', 'US History', 'Industrialization', 35, 1),
  ('ss_ush_7', 'social_studies', 'utah_core', 'SS.USH.7', 'Immigration and Urbanization', 'Understand waves of immigration and growth of American cities.', NULL, 'middle', 'US History', 'Social Change', 36, 1),

  -- Modern America
  ('ss_ush_8', 'social_studies', 'utah_core', 'SS.USH.8', 'Civil Rights Movements', 'Analyze struggles for equality by African Americans, women, and other groups.', NULL, 'middle', 'US History', 'Social Change', 37, 1),
  ('ss_ush_9', 'social_studies', 'utah_core', 'SS.USH.9', 'America as Global Power', 'Examine America''s role in world wars, Cold War, and modern conflicts.', NULL, 'middle', 'US History', 'Global Role', 38, 1),
  ('ss_ush_10', 'social_studies', 'utah_core', 'SS.USH.10', 'Progressive Era Reforms', 'Understand reform movements addressing industrialization''s social problems.', NULL, 'middle', 'US History', 'Social Change', 39, 1),
  ('ss_ush_11', 'social_studies', 'utah_core', 'SS.USH.11', 'Great Depression and New Deal', 'Analyze economic collapse and government response that reshaped federal role.', NULL, 'middle', 'US History', 'Economic Systems', 40, 1);

-- ============================================================================
-- US GOVERNMENT & CIVICS STANDARDS (SS.GOV) - 0.5 credits
-- CRITICAL: Utah Civics Test requirement - foundational civic knowledge
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Constitutional Framework
  ('ss_gov_1', 'social_studies', 'utah_core', 'SS.GOV.1', 'Constitution Structure', 'Understand the organization and purpose of the US Constitution and its articles.', NULL, 'middle', 'US Government', 'Constitutional Framework', 50, 1),
  ('ss_gov_2', 'social_studies', 'utah_core', 'SS.GOV.2', 'Three Branches of Government', 'Analyze powers and responsibilities of legislative, executive, and judicial branches.', NULL, 'middle', 'US Government', 'Constitutional Framework', 51, 1),
  ('ss_gov_3', 'social_studies', 'utah_core', 'SS.GOV.3', 'Checks and Balances', 'Examine how each branch limits the others to prevent concentration of power.', NULL, 'middle', 'US Government', 'Constitutional Framework', 52, 1),
  ('ss_gov_4', 'social_studies', 'utah_core', 'SS.GOV.4', 'Federalism', 'Understand division of power between federal and state governments.', NULL, 'middle', 'US Government', 'Constitutional Framework', 53, 1),

  -- Rights and Participation
  ('ss_gov_5', 'social_studies', 'utah_core', 'SS.GOV.5', 'Bill of Rights', 'Analyze the first ten amendments and individual liberties they protect.', NULL, 'middle', 'US Government', 'Rights and Freedoms', 54, 1),
  ('ss_gov_6', 'social_studies', 'utah_core', 'SS.GOV.6', 'Civic Participation', 'Understand ways citizens participate in democracy beyond voting.', NULL, 'middle', 'US Government', 'Civic Engagement', 55, 1),
  ('ss_gov_7', 'social_studies', 'utah_core', 'SS.GOV.7', 'Elections and Voting', 'Examine electoral systems, campaigns, and importance of informed voting.', NULL, 'middle', 'US Government', 'Civic Engagement', 56, 1),
  ('ss_gov_8', 'social_studies', 'utah_core', 'SS.GOV.8', 'Utah State Government', 'Understand Utah state government structure and relationship to federal system.', NULL, 'middle', 'US Government', 'State and Local', 57, 1),
  ('ss_gov_9', 'social_studies', 'utah_core', 'SS.GOV.9', 'Political Parties and Interest Groups', 'Analyze role of parties and interest groups in American political system.', NULL, 'middle', 'US Government', 'Political Process', 58, 1),
  ('ss_gov_10', 'social_studies', 'utah_core', 'SS.GOV.10', 'Constitutional Amendments', 'Understand amendment process and how Constitution has changed over time.', NULL, 'middle', 'US Government', 'Constitutional Framework', 59, 1);

-- ============================================================================
-- SYSTEMS THINKING STANDARDS (SS.SYS)
-- Meta-level understanding of how societies function
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ss_sys_1', 'social_studies', 'hyro_advanced', 'SS.SYS.1', 'Cause and Effect Chains', 'Identify how historical events create cascading effects across time and space.', NULL, 'middle', 'Systems Thinking', 'Historical Analysis', 70, 1, 1),
  ('ss_sys_2', 'social_studies', 'hyro_advanced', 'SS.SYS.2', 'Feedback Loops in Societies', 'Recognize reinforcing and balancing feedback loops in social systems.', NULL, 'middle', 'Systems Thinking', 'Systems Analysis', 71, 1, 1),
  ('ss_sys_3', 'social_studies', 'hyro_advanced', 'SS.SYS.3', 'Unintended Consequences', 'Analyze how policies and actions produce unexpected outcomes.', NULL, 'middle', 'Systems Thinking', 'Systems Analysis', 72, 1, 1),
  ('ss_sys_4', 'social_studies', 'hyro_advanced', 'SS.SYS.4', 'Network Effects', 'Understand how connections between people and groups amplify change.', NULL, 'middle', 'Systems Thinking', 'Systems Analysis', 73, 1, 1),
  ('ss_sys_5', 'social_studies', 'hyro_advanced', 'SS.SYS.5', 'Path Dependence', 'Recognize how past institutional choices constrain future options.', NULL, 'middle', 'Systems Thinking', 'Systems Analysis', 74, 1, 1),
  ('ss_sys_6', 'social_studies', 'hyro_advanced', 'SS.SYS.6', 'Social Change Patterns', 'Identify common patterns in how societies transform over time.', NULL, 'middle', 'Systems Thinking', 'Historical Analysis', 75, 1, 1);

-- ============================================================================
-- HISTORIOGRAPHY STANDARDS (SS.HIS)
-- Understanding how we know about the past and evaluate historical claims
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed, is_extension) VALUES
  ('ss_his_1', 'social_studies', 'hyro_advanced', 'SS.HIS.1', 'Primary vs Secondary Sources', 'Distinguish between firsthand accounts and later interpretations of events.', NULL, 'middle', 'Historiography', 'Historical Evidence', 80, 1, 1),
  ('ss_his_2', 'social_studies', 'hyro_advanced', 'SS.HIS.2', 'Historical Bias', 'Recognize how author perspective and context shape historical narratives.', NULL, 'middle', 'Historiography', 'Critical Analysis', 81, 1, 1),
  ('ss_his_3', 'social_studies', 'hyro_advanced', 'SS.HIS.3', 'Perspective and Interpretation', 'Analyze how different groups experienced and remember the same events differently.', NULL, 'middle', 'Historiography', 'Critical Analysis', 82, 1, 1),
  ('ss_his_4', 'social_studies', 'hyro_advanced', 'SS.HIS.4', 'Evidence Evaluation', 'Assess credibility and usefulness of historical sources.', NULL, 'middle', 'Historiography', 'Historical Evidence', 83, 1, 1),
  ('ss_his_5', 'social_studies', 'hyro_advanced', 'SS.HIS.5', 'Competing Narratives', 'Compare different historical interpretations and evaluate their evidence.', NULL, 'middle', 'Historiography', 'Critical Analysis', 84, 1, 1),
  ('ss_his_6', 'social_studies', 'hyro_advanced', 'SS.HIS.6', 'Presentism', 'Avoid judging past societies solely by modern values and understand historical context.', NULL, 'middle', 'Historiography', 'Critical Analysis', 85, 1, 1);

-- ============================================================================
-- CURRICULUM TOPICS - WORLD GEOGRAPHY
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_geo_physical', 'social_studies', 'ss_geo_1', 'Physical Features and Climate Zones', 'Understanding Earth''s major landforms, bodies of water, and climate patterns', '["Identify major landforms and water bodies", "Describe climate zone characteristics", "Explain how physical geography shapes human activity"]', 1, 25),
  ('topic_ss_geo_adaptation', 'social_studies', 'ss_geo_2', 'Human Adaptation to Environment', 'How humans adapt to different environments and climates', '["Analyze adaptation strategies in different climates", "Evaluate environmental modifications", "Understand sustainability challenges"]', 2, 30),
  ('topic_ss_geo_maps', 'social_studies', 'ss_geo_3', 'Map Reading and Analysis', 'Interpreting different types of maps and geographic data', '["Read political and physical maps", "Interpret thematic maps", "Analyze spatial patterns"]', 2, 25),
  ('topic_ss_geo_climate_culture', 'social_studies', 'ss_geo_4', 'Climate''s Influence on Culture', 'How climate shapes cultural practices and development', '["Connect climate to agricultural practices", "Explain cultural adaptations to climate", "Analyze settlement patterns"]', 2, 30),
  ('topic_ss_geo_resources', 'social_studies', 'ss_geo_5', 'Resource Distribution and Conflict', 'How natural resources drive economics and conflict', '["Identify major resource regions", "Analyze resource-based conflicts", "Understand resource curse"]', 3, 35),
  ('topic_ss_geo_globalization', 'social_studies', 'ss_geo_6', 'Global Interconnections', 'Understanding global trade, cultural exchange, and interdependence', '["Map global trade flows", "Analyze cultural globalization", "Evaluate environmental globalization"]', 3, 35),
  ('topic_ss_geo_population', 'social_studies', 'ss_geo_7', 'Population Patterns', 'Understanding population distribution and migration', '["Analyze population density patterns", "Explain push/pull migration factors", "Examine urbanization trends"]', 2, 30),
  ('topic_ss_geo_economic', 'social_studies', 'ss_geo_8', 'Economic Activity Patterns', 'Spatial patterns of agriculture, industry, and services', '["Compare economic systems geographically", "Analyze trade networks", "Understand development disparities"]', 2, 30);

-- ============================================================================
-- CURRICULUM TOPICS - WORLD HISTORY
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_whi_civ_patterns', 'social_studies', 'ss_whi_1', 'Civilizational Life Cycles', 'Patterns in how civilizations rise and fall', '["Identify factors enabling civilization emergence", "Analyze causes of civilizational decline", "Compare different civilization trajectories"]', 3, 40),
  ('topic_ss_whi_agriculture', 'social_studies', 'ss_whi_2', 'Agricultural Revolution Impact', 'How farming transformed human societies', '["Explain surplus and specialization", "Analyze social hierarchy emergence", "Understand sedentary vs nomadic life"]', 2, 30),
  ('topic_ss_whi_trade', 'social_studies', 'ss_whi_3', 'Ancient Trade Networks', 'How trade connected ancient civilizations', '["Map major trade routes", "Analyze cultural diffusion via trade", "Evaluate trade''s role in spreading technology"]', 2, 30),
  ('topic_ss_whi_industrial', 'social_studies', 'ss_whi_4', 'Industrial Revolution Changes', 'How industrialization transformed society', '["Explain factory system emergence", "Analyze urbanization consequences", "Understand labor movement origins"]', 2, 35),
  ('topic_ss_whi_colonialism', 'social_studies', 'ss_whi_5', 'European Colonialism', 'Colonial expansion and its lasting impacts', '["Map colonial empires", "Analyze motivations for colonization", "Evaluate postcolonial challenges"]', 3, 40),
  ('topic_ss_whi_20th', 'social_studies', 'ss_whi_6', '20th Century Global Conflicts', 'World wars and ideological struggles', '["Understand WWI and WWII causes", "Analyze Cold War dynamics", "Examine decolonization movements"]', 3, 40),
  ('topic_ss_whi_tech', 'social_studies', 'ss_whi_7', 'Technology as Change Driver', 'How innovations reshape societies', '["Connect inventions to social change", "Analyze communication technology impacts", "Understand acceleration of change"]', 2, 30),
  ('topic_ss_whi_religion', 'social_studies', 'ss_whi_8', 'World Religions as Systems', 'Major religions as organizing forces', '["Compare major world religions", "Analyze religion''s role in government", "Understand religious conflict patterns"]', 2, 35),
  ('topic_ss_whi_revolutions', 'social_studies', 'ss_whi_9', 'Revolutionary Patterns', 'Common features of revolutions', '["Identify revolutionary preconditions", "Compare French, American, Russian revolutions", "Analyze revolutionary outcomes"]', 3, 35),
  ('topic_ss_whi_empires', 'social_studies', 'ss_whi_10', 'Empire Building Strategies', 'How empires expand and why they fall', '["Compare imperial strategies", "Analyze overextension patterns", "Understand imperial collapse"]', 3, 35);

-- ============================================================================
-- CURRICULUM TOPICS - US HISTORY
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_ush_founding', 'social_studies', 'ss_ush_1', 'Enlightenment and Founding', 'Ideas that shaped American government', '["Explain social contract theory", "Analyze natural rights philosophy", "Connect Enlightenment to Declaration"]', 2, 30),
  ('topic_ss_ush_constitution', 'social_studies', 'ss_ush_2', 'Constitutional Evolution', 'How the Constitution has changed and been interpreted', '["Understand original vs current interpretation", "Analyze major amendments", "Examine judicial review"]', 3, 35),
  ('topic_ss_ush_expansion', 'social_studies', 'ss_ush_3', 'Westward Expansion', 'American expansion and its consequences', '["Analyze Manifest Destiny ideology", "Examine impact on Native Americans", "Understand territorial acquisition"]', 2, 35),
  ('topic_ss_ush_slavery', 'social_studies', 'ss_ush_4', 'Slavery and Sectional Conflict', 'How slavery divided the nation', '["Understand economic vs moral arguments", "Analyze compromise failures", "Examine states'' rights debates"]', 3, 35),
  ('topic_ss_ush_civil_war', 'social_studies', 'ss_ush_5', 'Civil War and Reconstruction', 'The war and failed reunion', '["Analyze war causes and consequences", "Understand Reconstruction goals", "Examine failure to protect freed people"]', 3, 40),
  ('topic_ss_ush_industrial', 'social_studies', 'ss_ush_6', 'American Industrialization', 'Industrial transformation of America', '["Explain rise of big business", "Analyze working conditions", "Understand monopoly formation"]', 2, 35),
  ('topic_ss_ush_immigration', 'social_studies', 'ss_ush_7', 'Immigration Waves', 'Immigration patterns and responses', '["Identify immigration waves and origins", "Analyze nativism and restriction", "Understand immigrant experiences"]', 2, 30),
  ('topic_ss_ush_civil_rights', 'social_studies', 'ss_ush_8', 'Civil Rights Struggles', 'Movements for equality and justice', '["Trace African American civil rights movement", "Analyze protest strategies", "Examine other equality movements"]', 2, 35),
  ('topic_ss_ush_global_power', 'social_studies', 'ss_ush_9', 'America on World Stage', 'US role in global conflicts and affairs', '["Understand isolationism vs intervention", "Analyze Cold War strategy", "Examine modern military involvement"]', 3, 35),
  ('topic_ss_ush_progressive', 'social_studies', 'ss_ush_10', 'Progressive Era Reforms', 'Reform responses to industrial problems', '["Identify Progressive Era reforms", "Analyze muckraker role", "Understand regulation expansion"]', 2, 30),
  ('topic_ss_ush_depression', 'social_studies', 'ss_ush_11', 'Depression and New Deal', 'Economic crisis and government response', '["Explain Great Depression causes", "Analyze New Deal programs", "Understand federal role expansion"]', 2, 35);

-- ============================================================================
-- CURRICULUM TOPICS - US GOVERNMENT & CIVICS
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_gov_constitution', 'social_studies', 'ss_gov_1', 'Constitution Fundamentals', 'Understanding the supreme law of the land', '["Explain Constitution''s purpose", "Identify seven articles", "Understand amendment process"]', 1, 25),
  ('topic_ss_gov_branches', 'social_studies', 'ss_gov_2', 'Three Branches Powers', 'Distinct roles of each branch', '["List legislative powers", "Identify executive powers", "Explain judicial powers"]', 2, 30),
  ('topic_ss_gov_checks', 'social_studies', 'ss_gov_3', 'Checks and Balances System', 'How branches limit each other', '["Identify specific checks", "Analyze separation of powers", "Evaluate balance effectiveness"]', 2, 30),
  ('topic_ss_gov_federalism', 'social_studies', 'ss_gov_4', 'Federal vs State Power', 'Division of power in American system', '["Distinguish federal and state powers", "Understand concurrent powers", "Analyze federal-state conflicts"]', 2, 30),
  ('topic_ss_gov_bill_rights', 'social_studies', 'ss_gov_5', 'Bill of Rights Protections', 'Individual liberties in first 10 amendments', '["Identify each amendment''s protection", "Analyze limits on government power", "Understand rights balancing"]', 2, 30),
  ('topic_ss_gov_participation', 'social_studies', 'ss_gov_6', 'Civic Participation Methods', 'Ways to engage in democracy', '["Identify participation methods beyond voting", "Understand civic responsibilities", "Analyze effective advocacy"]', 2, 25),
  ('topic_ss_gov_elections', 'social_studies', 'ss_gov_7', 'Electoral Systems', 'How Americans elect leaders', '["Understand Electoral College", "Explain primary and general elections", "Analyze campaign finance"]', 2, 30),
  ('topic_ss_gov_utah', 'social_studies', 'ss_gov_8', 'Utah State Government', 'How Utah government operates', '["Identify Utah government structure", "Understand state constitution", "Compare to federal system"]', 2, 25),
  ('topic_ss_gov_parties', 'social_studies', 'ss_gov_9', 'Political Parties and Groups', 'Role of parties and interest groups', '["Compare two-party system", "Analyze interest group influence", "Understand lobbying"]', 2, 30),
  ('topic_ss_gov_amendments', 'social_studies', 'ss_gov_10', 'Constitutional Amendments', 'How the Constitution changes', '["Explain amendment process", "Identify major amendments", "Analyze interpretation changes"]', 2, 25);

-- ============================================================================
-- CURRICULUM TOPICS - SYSTEMS THINKING
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_sys_causation', 'social_studies', 'ss_sys_1', 'Causal Chains in History', 'Tracing cause and effect over time', '["Identify immediate vs long-term causes", "Map causal chains", "Distinguish correlation from causation"]', 3, 35),
  ('topic_ss_sys_feedback', 'social_studies', 'ss_sys_2', 'Social Feedback Loops', 'Reinforcing and balancing loops', '["Identify reinforcing loops (snowball effects)", "Recognize balancing loops", "Analyze loop interactions"]', 4, 40),
  ('topic_ss_sys_unintended', 'social_studies', 'ss_sys_3', 'Unintended Consequences', 'When solutions create new problems', '["Identify historical unintended consequences", "Analyze why they occur", "Predict potential consequences"]', 3, 35),
  ('topic_ss_sys_networks', 'social_studies', 'ss_sys_4', 'Network Effects in Society', 'How connections amplify change', '["Understand network externalities", "Analyze critical mass", "Examine diffusion of innovations"]', 4, 35),
  ('topic_ss_sys_path', 'social_studies', 'ss_sys_5', 'Institutional Path Dependence', 'How past constrains future', '["Understand lock-in effects", "Analyze institutional inertia", "Identify critical junctures"]', 4, 40),
  ('topic_ss_sys_change', 'social_studies', 'ss_sys_6', 'Patterns of Social Change', 'Common patterns in transformation', '["Identify gradual vs punctuated change", "Analyze tipping points", "Understand S-curves of adoption"]', 3, 35);

-- ============================================================================
-- CURRICULUM TOPICS - HISTORIOGRAPHY
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  ('topic_ss_his_sources', 'social_studies', 'ss_his_1', 'Primary and Secondary Sources', 'Understanding different types of evidence', '["Define primary sources", "Define secondary sources", "Evaluate source type usefulness"]', 2, 25),
  ('topic_ss_his_bias', 'social_studies', 'ss_his_2', 'Detecting Historical Bias', 'Recognizing perspective in sources', '["Identify author bias indicators", "Analyze context influence", "Compare biased accounts"]', 3, 30),
  ('topic_ss_his_perspective', 'social_studies', 'ss_his_3', 'Multiple Perspectives', 'How different groups remember events', '["Compare perspectives on same event", "Understand whose story is told", "Analyze missing voices"]', 3, 35),
  ('topic_ss_his_evidence', 'social_studies', 'ss_his_4', 'Evaluating Historical Evidence', 'Assessing source credibility', '["Apply CRAAP test", "Identify corroboration", "Assess source limitations"]', 3, 30),
  ('topic_ss_his_narratives', 'social_studies', 'ss_his_5', 'Competing Historical Narratives', 'Different interpretations of the past', '["Compare historical interpretations", "Evaluate evidence for each", "Understand historiographical debates"]', 4, 35),
  ('topic_ss_his_presentism', 'social_studies', 'ss_his_6', 'Avoiding Presentism', 'Understanding past on its own terms', '["Recognize presentist thinking", "Practice historical empathy", "Contextualize past values"]', 3, 30);

-- ============================================================================
-- QUESTION BANK - WORLD GEOGRAPHY (15 questions)
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Physical Geography
('q_ss_geo_001', 'social_studies', 'ss_geo_1', 'topic_ss_geo_physical', 'multiple_choice', 'Which climate zone would you expect to find near the equator?', '["Polar/Tundra", "Tropical", "Temperate", "Subarctic"]', 'Tropical', 'The equator receives the most direct sunlight year-round, creating warm, humid tropical climates. Temperature decreases as you move toward the poles.', 25, 1, 'remember', 1, '["Think about where the sun is most direct", "Which zone is hottest?"]'),

('q_ss_geo_002', 'social_studies', 'ss_geo_1', 'topic_ss_geo_physical', 'multiple_choice', 'How do mountains affect climate patterns?', '["They have no effect on climate", "They create rain shadows on their leeward side", "They make both sides equally wet", "They only affect temperature, not precipitation"]', 'They create rain shadows on their leeward side', 'As air rises over mountains, it cools and drops precipitation on the windward side. The leeward (downwind) side becomes dry - this is called a rain shadow effect.', 45, 2, 'understand', 2, '["What happens to air as it rises?", "Think about which side gets rain first"]'),

-- Human-Environment Interaction
('q_ss_geo_003', 'social_studies', 'ss_geo_2', 'topic_ss_geo_adaptation', 'multiple_choice', 'Which is an example of humans MODIFYING the environment rather than adapting to it?', '["Wearing warm clothing in cold climates", "Building homes on stilts in flood zones", "Constructing a dam to control river flooding", "Using air conditioning in hot weather"]', 'Constructing a dam to control river flooding', 'Building a dam physically changes the environment by controlling water flow. Wearing clothing, building on stilts, and using AC are adaptations that don''t fundamentally change the environment.', 40, 2, 'analyze', 2, '["Which option changes nature itself?", "Adaptation works WITH nature, modification changes it"]'),

('q_ss_geo_004', 'social_studies', 'ss_geo_2', 'topic_ss_geo_adaptation', 'multiple_choice', 'Why do nomadic herding societies exist primarily in grassland and desert regions?', '["These areas have the most water", "Vegetation is sparse, requiring movement to find fresh grazing", "These regions are easiest to farm", "Mountains prevent settlement"]', 'Vegetation is sparse, requiring movement to find fresh grazing', 'In arid grasslands and deserts, vegetation grows sparsely and takes time to regenerate. Herders must move their animals to new areas to find fresh grazing, preventing overgrazing.', 50, 2, 'analyze', 3, '["Why would people need to keep moving?", "Think about resource availability"]'),

-- Maps and Spatial Thinking
('q_ss_geo_005', 'social_studies', 'ss_geo_3', 'topic_ss_geo_maps', 'multiple_choice', 'What is the main PURPOSE of using different map projections?', '["To make maps look more artistic", "Different projections preserve different properties (shape, area, distance)", "To confuse people", "To sell more maps"]', 'Different projections preserve different properties (shape, area, distance)', 'It''s impossible to perfectly represent the 3D Earth on a 2D surface. Different projections make trade-offs, preserving some properties (like accurate shapes or areas) at the expense of others.', 45, 2, 'understand', 2, '["Why is it hard to flatten a sphere?", "What might matter for different uses?"]'),

-- Climate and Culture
('q_ss_geo_006', 'social_studies', 'ss_geo_4', 'topic_ss_geo_climate_culture', 'multiple_choice', 'How did climate influence the development of rice cultivation in monsoon Asia?', '["The cold climate preserved rice seeds", "Heavy seasonal rains provided water needed for rice paddies", "Dry conditions prevented crop disease", "Mountains provided irrigation"]', 'Heavy seasonal rains provided water needed for rice paddies', 'Rice cultivation requires large amounts of water. Monsoon regions receive intense seasonal rainfall that can be captured in paddies, making rice farming highly productive and supporting large populations.', 45, 2, 'analyze', 2, '["What does rice need to grow?", "What do monsoons bring?"]'),

('q_ss_geo_007', 'social_studies', 'ss_geo_4', 'topic_ss_geo_climate_culture', 'multiple_choice', 'Why are most of the world''s least developed countries located in tropical regions?', '["Tropical diseases affect human productivity and health", "Tropical soil is often nutrient-poor despite lush vegetation", "High temperatures can make agricultural and industrial work more difficult", "All of the above"]', 'All of the above', 'Tropical development challenges are complex: disease burden reduces productivity, rapid decomposition depletes soil nutrients, and heat affects work capacity. This creates a "geography trap" that''s difficult but not impossible to overcome.', 60, 3, 'analyze', 3, '["Consider multiple factors", "Think about health, agriculture, and climate"]'),

-- Resources and Conflict
('q_ss_geo_008', 'social_studies', 'ss_geo_5', 'topic_ss_geo_resources', 'multiple_choice', 'What is the "resource curse" phenomenon?', '["Resources running out quickly", "Countries with abundant natural resources often have worse economic outcomes", "Resources being too expensive to extract", "Too many resources causing environmental damage"]', 'Countries with abundant natural resources often have worse economic outcomes', 'The resource curse (or paradox of plenty) shows that countries with abundant oil, minerals, etc. often have slower growth, more corruption, and more conflict than resource-poor countries due to political and economic distortions.', 55, 3, 'understand', 2, '["Think about unexpected outcomes", "Why might wealth cause problems?"]'),

('q_ss_geo_009', 'social_studies', 'ss_geo_5', 'topic_ss_geo_resources', 'multiple_choice', 'Why is control of water resources a major source of conflict in the Middle East?', '["Water is needed for drinking, agriculture, and industry in a dry region", "Rivers cross national boundaries creating disputes", "Population growth increases water demand", "All of the above"]', 'All of the above', 'Water scarcity in arid Middle East makes water strategically crucial. International rivers (Nile, Jordan, Tigris-Euphrates) create upstream-downstream tensions, especially as populations grow and climate changes.', 50, 3, 'analyze', 3, '["Consider multiple aspects of water importance", "Think about geography and population"]'),

-- Globalization
('q_ss_geo_010', 'social_studies', 'ss_geo_6', 'topic_ss_geo_globalization', 'multiple_choice', 'Which is the BEST example of economic globalization?', '["A smartphone designed in California, manufactured in China, sold globally", "A local farmer selling at a farmers market", "A family cooking traditional recipes", "Reading books by authors from your country"]', 'A smartphone designed in California, manufactured in China, sold globally', 'Economic globalization involves production chains spanning multiple countries, global markets, and international trade. The smartphone example shows global division of labor and integrated supply chains.', 40, 2, 'apply', 2, '["Which crosses the most borders?", "Think about global supply chains"]'),

('q_ss_geo_011', 'social_studies', 'ss_geo_6', 'topic_ss_geo_globalization', 'multiple_choice', 'How has globalization created environmental challenges?', '["Pollution in one country affects neighbors through air and water", "Demand for resources in rich countries drives deforestation elsewhere", "Carbon emissions from global shipping contribute to climate change", "All of the above"]', 'All of the above', 'Environmental problems are increasingly global: pollution crosses borders, consumption in one place drives environmental damage elsewhere, and climate change is a planetary problem requiring global cooperation.', 50, 3, 'analyze', 3, '["Think about environmental connections", "How do activities in one place affect others?"]'),

-- Population and Migration
('q_ss_geo_012', 'social_studies', 'ss_geo_7', 'topic_ss_geo_population', 'multiple_choice', 'Which is a "pull factor" attracting immigration rather than a "push factor" forcing emigration?', '["War and violence in home country", "Economic opportunity in destination country", "Political persecution", "Natural disaster"]', 'Economic opportunity in destination country', 'Pull factors attract migrants TO a destination (jobs, safety, opportunity). Push factors force people AWAY from home (war, persecution, disaster, poverty). Economic opportunity is a pull factor.', 35, 2, 'understand', 2, '["What attracts vs what repels?", "Think about the destination vs origin"]'),

('q_ss_geo_013', 'social_studies', 'ss_geo_7', 'topic_ss_geo_population', 'multiple_choice', 'Why are many countries experiencing "urbanization" - movement to cities?', '["Cities force people to move there", "Cities offer jobs, services, and opportunities not available rurally", "Rural areas are becoming uninhabitable", "City living is always easier"]', 'Cities offer jobs, services, and opportunities not available rurally', 'Urbanization is driven by economic opportunity: cities concentrate jobs, education, healthcare, and culture. As economies develop from agricultural to industrial/service-based, people migrate to cities seeking better opportunities.', 40, 2, 'analyze', 2, '["What advantages do cities offer?", "Think about economic opportunities"]'),

-- Economic Geography
('q_ss_geo_014', 'social_studies', 'ss_geo_8', 'topic_ss_geo_economic', 'multiple_choice', 'Why are most major cities located near water (rivers, coasts, lakes)?', '["Water provides drinking water only", "Water enables trade and transportation, historically vital for economic growth", "Cities need water for decoration", "Random chance"]', 'Water enables trade and transportation, historically vital for economic growth', 'Before modern transportation, water was the cheapest way to move goods and people. Cities grew at natural harbors, river crossings, and confluences because they became trade hubs, accumulating economic and political power.', 45, 2, 'analyze', 2, '["How did people transport goods historically?", "Why would traders gather in certain spots?"]'),

('q_ss_geo_015', 'social_studies', 'ss_geo_8', 'topic_ss_geo_economic', 'multiple_choice', 'What is "comparative advantage" in international trade?', '["Being better than everyone at everything", "Focusing on what you produce most efficiently relative to others, even if not the absolute best", "Having the most resources", "Being the largest country"]', 'Focusing on what you produce most efficiently relative to others, even if not the absolute best', 'Comparative advantage means countries benefit from specializing in what they do relatively well and trading for the rest, even if another country could produce everything more efficiently. This is the foundation of trade gains.', 55, 3, 'understand', 2, '["Think about relative efficiency", "Even if you''re not the best, what are you best at?"]');

-- ============================================================================
-- QUESTION BANK - WORLD HISTORY (15 questions)
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Civilizational Patterns
('q_ss_whi_001', 'social_studies', 'ss_whi_1', 'topic_ss_whi_civ_patterns', 'multiple_choice', 'What do most early civilizations have in common geographically?', '["They developed in mountains", "They developed in river valleys with fertile soil", "They developed in deserts", "They developed on islands"]', 'They developed in river valleys with fertile soil', 'Early civilizations (Mesopotamia, Egypt, Indus, China) emerged in river valleys because reliable water and fertile floodplain soil enabled surplus food production, supporting larger populations and specialization.', 35, 2, 'analyze', 2, '["Where did farming work best?", "What do Nile, Tigris-Euphrates, Indus have in common?"]'),

('q_ss_whi_002', 'social_studies', 'ss_whi_1', 'topic_ss_whi_civ_patterns', 'multiple_choice', 'Which factor MOST commonly contributes to civilizational decline?', '["Environmental degradation and resource depletion", "Overextension and inability to defend borders", "Internal political instability and inequality", "All of the above contribute to different collapses"]', 'All of the above contribute to different collapses', 'Civilizational collapse is complex and multicausal. Rome faced overextension, Maya dealt with environmental stress, and many civilizations experienced internal instability. Usually multiple factors combine to create vulnerability.', 60, 3, 'analyze', 3, '["Are collapses usually simple or complex?", "Think about different civilizations"]'),

-- Agricultural Revolution
('q_ss_whi_003', 'social_studies', 'ss_whi_2', 'topic_ss_whi_agriculture', 'multiple_choice', 'How did agriculture lead to social hierarchy and inequality?', '["Surplus food enabled specialization and wealth accumulation", "Some land was more productive, creating wealth differences", "Control of surplus gave some people power over others", "All of the above"]', 'All of the above', 'Agriculture created storable surplus, enabling non-farmers (specialists, rulers, priests). Land quality varied, creating wealth differences. Those controlling surplus gained power, establishing social hierarchies absent in egalitarian hunter-gatherer societies.', 50, 2, 'analyze', 3, '["What does surplus enable?", "How might surplus create power differences?"]'),

('q_ss_whi_004', 'social_studies', 'ss_whi_2', 'topic_ss_whi_agriculture', 'multiple_choice', 'What was a major DISADVANTAGE of early agricultural societies compared to hunter-gatherers?', '["Worse nutrition and more disease due to crowding and grain-based diet", "Less free time due to farming labor", "Vulnerability to crop failures and famine", "All of the above"]', 'All of the above', 'Early farmers actually had worse health (shorter stature, more disease, worse teeth) and worked harder than hunter-gatherers. Agriculture''s advantage was supporting larger populations, not improving individual lives initially.', 55, 3, 'understand', 2, '["Was agriculture better for individuals or populations?", "Think about unexpected downsides"]'),

-- Trade Networks
('q_ss_whi_005', 'social_studies', 'ss_whi_3', 'topic_ss_whi_trade', 'multiple_choice', 'Besides goods, what did the Silk Road spread between East and West?', '["Only silk and spices", "Ideas, religions, technologies, and diseases", "Nothing but physical products", "Only military knowledge"]', 'Ideas, religions, technologies, and diseases', 'The Silk Road facilitated cultural exchange: Buddhism spread to China, paper and gunpowder moved West, mathematical ideas traveled, and so did diseases like plague. Trade routes are idea routes.', 40, 2, 'understand', 2, '["What besides goods can travel on trade routes?", "Think about non-physical things"]'),

-- Industrial Revolution
('q_ss_whi_006', 'social_studies', 'ss_whi_4', 'topic_ss_whi_industrial', 'multiple_choice', 'Why did the Industrial Revolution START in Britain rather than elsewhere?', '["Britain had coal and iron resources", "Britain had capital from trade and empire", "Britain had political stability and property rights", "All of the above factors came together"]', 'All of the above factors came together', 'Britain''s Industrial Revolution resulted from convergence: accessible coal, colonies providing raw materials and markets, financial institutions, stable property rights, and scientific culture. No single factor explains it.', 55, 3, 'analyze', 3, '["Think about multiple necessary conditions", "Why Britain and not China or elsewhere?"]'),

('q_ss_whi_007', 'social_studies', 'ss_whi_4', 'topic_ss_whi_industrial', 'multiple_choice', 'How did industrialization change the nature of work?', '["Shifted from skilled artisan work to repetitive factory labor", "Created clock-based time discipline replacing seasonal rhythms", "Separated home and workplace", "All of the above"]', 'All of the above', 'Industrialization transformed work fundamentally: craftspeople became factory workers doing repetitive tasks, factory clocks replaced natural rhythms, and people left home to work in factories, separating work and domestic life.', 45, 2, 'analyze', 2, '["How was factory work different from farming or crafts?", "Think about multiple dimensions of change"]'),

-- Colonialism
('q_ss_whi_008', 'social_studies', 'ss_whi_5', 'topic_ss_whi_colonialism', 'multiple_choice', 'What is "neo-colonialism"?', '["Continuing economic control of former colonies through trade, debt, and corporations", "New direct military occupation", "Colonies voluntarily rejoining empires", "A modern architecture style"]', 'Continuing economic control of former colonies through trade, debt, and corporations', 'Neo-colonialism describes how former colonial powers maintain economic dominance through unequal trade, debt relationships, control of resources, and corporate power even after political independence.', 60, 3, 'understand', 2, '["What might control look like without direct rule?", "Think about economic power"]'),

('q_ss_whi_009', 'social_studies', 'ss_whi_5', 'topic_ss_whi_colonialism', 'multiple_choice', 'How did colonial borders drawn by Europeans create problems in Africa?', '["Borders ignored ethnic and cultural groups, creating conflict", "Borders united traditional enemies within single colonies", "Borders separated ethnic groups across different colonies", "All of the above"]', 'All of the above', 'European colonizers drew borders for their convenience, ignoring existing political and cultural boundaries. This created ethnically diverse colonies with no common identity and split ethnic groups across borders, fueling post-independence conflicts.', 50, 3, 'analyze', 3, '["Who drew borders and what did they ignore?", "What happens when borders ignore cultures?"]'),

-- 20th Century
('q_ss_whi_010', 'social_studies', 'ss_whi_6', 'topic_ss_whi_20th', 'multiple_choice', 'What was the fundamental difference between World War I and previous wars?', '["It was the first war", "Industrial technology made it far more deadly and total mobilization was required", "It lasted longer than any previous war", "It had more countries involved"]', 'Industrial technology made it far more deadly and total mobilization was required', 'WWI''s industrial nature (machine guns, artillery, poison gas, tanks) created unprecedented casualties. Total war required mobilizing entire economies and societies, not just professional armies, fundamentally changing warfare.', 50, 2, 'analyze', 2, '["How did industrial technology affect war?", "Think about scale and intensity"]'),

('q_ss_whi_011', 'social_studies', 'ss_whi_6', 'topic_ss_whi_20th', 'multiple_choice', 'What was the Cold War "cold" about?', '["It happened in winter", "The US and USSR never directly fought each other militarily", "Nuclear weapons froze conflict", "It involved arctic regions"]', 'The US and USSR never directly fought each other militarily', 'The Cold War was "cold" because the US and USSR, despite intense rivalry, never directly fought due to nuclear deterrence. They competed through proxies, espionage, propaganda, and arms races instead.', 40, 2, 'understand', 2, '["Why didn''t the superpowers fight directly?", "What does cold mean here?"]'),

-- Technology and Social Change
('q_ss_whi_012', 'social_studies', 'ss_whi_7', 'topic_ss_whi_tech', 'multiple_choice', 'How did the printing press change European society?', '["It only made books cheaper", "It enabled mass literacy, spread of ideas, and challenged Church authority", "It just helped scholars", "It had no major social impact"]', 'It enabled mass literacy, spread of ideas, and challenged Church authority', 'The printing press democratized knowledge by making books affordable, enabling mass literacy. This spread Reformation ideas, scientific knowledge, and challenged authorities who had monopolized information (like the Catholic Church).', 45, 2, 'analyze', 2, '["Who controlled books before printing?", "What happens when knowledge spreads?"]'),

-- Religion
('q_ss_whi_013', 'social_studies', 'ss_whi_8', 'topic_ss_whi_religion', 'multiple_choice', 'What role did religion play in pre-modern societies?', '["Only spiritual guidance", "Only moral rules", "Organized social life, legitimized rulers, provided law, and unified communities", "Just explained natural phenomena"]', 'Organized social life, legitimized rulers, provided law, and unified communities', 'In pre-modern societies, religion was the primary organizing institution: it legitimized political authority, provided legal codes, structured time (calendars, holidays), and created shared identity beyond kinship.', 50, 2, 'analyze', 3, '["Think beyond just belief", "How did religion organize society?"]'),

-- Revolutions
('q_ss_whi_014', 'social_studies', 'ss_whi_9', 'topic_ss_whi_revolutions', 'multiple_choice', 'What do most successful revolutions have in common?', '["Strong military forces", "State weakness combined with mobilized grievances and alternative vision", "Foreign intervention", "Wealthy leaders"]', 'State weakness combined with mobilized grievances and alternative vision', 'Revolutions typically require three elements: a weakened state unable to maintain control, widespread organized grievances, and an alternative ideology/vision. Successful revolutions need all three, not just discontent.', 60, 3, 'analyze', 3, '["What conditions enable revolution?", "Think about multiple necessary factors"]'),

-- Empires
('q_ss_whi_015', 'social_studies', 'ss_whi_10', 'topic_ss_whi_empires', 'multiple_choice', 'Why do empires typically collapse when they become overextended?', '["They run out of money", "The cost of defending distant borders exceeds the resources extracted from them", "They get bored with conquering", "Emperors become lazy"]', 'The cost of defending distant borders exceeds the resources extracted from them', 'Imperial overextension creates a negative feedback loop: distant territories are expensive to defend, drain resources, and become vulnerable. Eventually, defense costs exceed extraction benefits, leading to retreat or collapse (like Rome, Soviet Union).', 55, 3, 'analyze', 3, '["Think about costs vs benefits of expansion", "What happens at the limits?"]');

-- ============================================================================
-- QUESTION BANK - US HISTORY (15 questions)
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Founding Principles
('q_ss_ush_001', 'social_studies', 'ss_ush_1', 'topic_ss_ush_founding', 'multiple_choice', 'Which Enlightenment idea is reflected in the Declaration of Independence''s statement that governments derive power from "consent of the governed"?', '["Divine right of kings", "Social contract theory", "Absolute monarchy", "Feudalism"]', 'Social contract theory', 'Social contract theory (Locke, Rousseau) holds that government legitimacy comes from the consent of the people, not divine right. The Declaration directly applies this: governments exist to protect rights, and people can alter them.', 45, 2, 'analyze', 2, '["Where does government power come from?", "Think about Locke''s ideas"]'),

('q_ss_ush_002', 'social_studies', 'ss_ush_1', 'topic_ss_ush_founding', 'multiple_choice', 'The Declaration of Independence states that all men have "unalienable rights" to "life, liberty, and the pursuit of happiness." What does "unalienable" mean?', '["Granted by government", "Cannot be taken away", "Applies only to citizens", "Limited by law"]', 'Cannot be taken away', 'Unalienable (or inalienable) rights cannot be surrendered, transferred, or taken away. They exist naturally, not granted by government. This is a key natural rights philosophy claim from Locke.', 35, 2, 'understand', 1, '["Can these rights be taken?", "Think about the root: not-alienable"]'),

-- Constitutional Development
('q_ss_ush_003', 'social_studies', 'ss_ush_2', 'topic_ss_ush_constitution', 'multiple_choice', 'How has the meaning of the Commerce Clause (Congress regulates interstate commerce) changed over time?', '["It hasn''t changed at all", "Interpreted narrowly at first, then broadly to allow federal regulation of economy", "Always interpreted broadly", "Removed from the Constitution"]', 'Interpreted narrowly at first, then broadly to allow federal regulation of economy', 'The Commerce Clause was initially interpreted narrowly. In the 20th century (especially New Deal era), courts allowed much broader interpretation, enabling federal regulation of labor, civil rights, and economic activity.', 55, 3, 'analyze', 3, '["Has interpretation expanded or narrowed?", "Think about federal power growth"]'),

('q_ss_ush_004', 'social_studies', 'ss_ush_2', 'topic_ss_ush_constitution', 'multiple_choice', 'What is "judicial review" and where does the power come from?', '["Congress reviewing court decisions; Article III", "Courts declaring laws unconstitutional; established in Marbury v. Madison", "Presidents reviewing court decisions; Article II", "Voters reviewing laws; the Bill of Rights"]', 'Courts declaring laws unconstitutional; established in Marbury v. Madison', 'Judicial review - courts'' power to declare laws unconstitutional - isn''t explicitly in the Constitution. Chief Justice Marshall established it in Marbury v. Madison (1803), fundamentally shaping American government.', 50, 2, 'understand', 2, '["Who reviews law constitutionality?", "Think about a famous early Supreme Court case"]'),

-- Westward Expansion
('q_ss_ush_005', 'social_studies', 'ss_ush_3', 'topic_ss_ush_expansion', 'multiple_choice', 'What was "Manifest Destiny"?', '["A legal treaty with Native Americans", "The belief that US expansion across North America was justified and inevitable", "A Supreme Court decision", "An economic policy"]', 'The belief that US expansion across North America was justified and inevitable', 'Manifest Destiny was the 19th-century belief that American expansion across the continent was both justified and inevitable - a "destiny" manifest (obvious). It rationalized taking Native and Mexican land.', 40, 2, 'understand', 2, '["What justified expansion in American minds?", "Think about ideology, not law"]'),

('q_ss_ush_006', 'social_studies', 'ss_ush_3', 'topic_ss_ush_expansion', 'multiple_choice', 'How did westward expansion affect Native American peoples?', '["They welcomed settlers peacefully", "Forced removal, broken treaties, cultural destruction, and death", "No significant impact", "They all moved to cities"]', 'Forced removal, broken treaties, cultural destruction, and death', 'Westward expansion was catastrophic for Native Americans: forced removal (Trail of Tears), broken treaties, wars, disease, cultural destruction, and confinement to reservations. Population declined dramatically.', 40, 2, 'understand', 2, '["Was expansion peaceful or violent?", "What happened to people already living there?"]'),

-- Slavery and Sectionalism
('q_ss_ush_007', 'social_studies', 'ss_ush_4', 'topic_ss_ush_slavery', 'multiple_choice', 'Why did slavery become a sectional issue dividing North and South?', '["The South''s economy depended on slave labor while the North industrialized with free labor", "New western territories raised questions about slavery''s expansion", "Moral and political conflicts intensified over time", "All of the above"]', 'All of the above', 'Slavery became sectional as Northern and Southern economies diverged (industrial vs agricultural), each westward expansion sparked conflict over slavery''s spread, and moral/political positions hardened, making compromise increasingly impossible.', 50, 3, 'analyze', 3, '["Why did North and South differ?", "Think about economic and moral dimensions"]'),

-- Civil War and Reconstruction
('q_ss_ush_008', 'social_studies', 'ss_ush_5', 'topic_ss_ush_civil_war', 'multiple_choice', 'Why is Reconstruction (1865-1877) considered a "failed" period?', '["The South wasn''t rebuilt", "It didn''t end slavery", "Initial goals of racial equality were abandoned, leaving African Americans vulnerable", "The North won the war"]', 'Initial goals of racial equality were abandoned, leaving African Americans vulnerable', 'Reconstruction initially promised equality and rights for freed people. But Northern commitment waned, federal troops withdrew (1877), and Southern whites reimposed control through Jim Crow laws, violence, and disenfranchisement.', 55, 3, 'evaluate', 3, '["What were Reconstruction''s goals?", "Were they achieved long-term?"]'),

('q_ss_ush_009', 'social_studies', 'ss_ush_5', 'topic_ss_ush_civil_war', 'multiple_choice', 'What were "Jim Crow" laws?', '["Laws that freed slaves", "State and local laws enforcing racial segregation in the South", "Federal civil rights protections", "Economic regulations"]', 'State and local laws enforcing racial segregation in the South', 'Jim Crow laws were Southern state/local laws enforcing racial segregation (separate schools, buses, facilities) after Reconstruction ended, lasting until the Civil Rights Movement of the 1960s.', 35, 2, 'understand', 1, '["Did these laws promote equality or segregation?", "When were they enacted?"]'),

-- Industrial Age
('q_ss_ush_010', 'social_studies', 'ss_ush_6', 'topic_ss_ush_industrial', 'multiple_choice', 'What were "robber barons" and "captains of industry" - and why both terms for the same people?', '["Different groups of businesspeople", "Same industrialists (Carnegie, Rockefeller) seen as either ruthless monopolists or economic innovators", "Government officials", "Union leaders"]', 'Same industrialists (Carnegie, Rockefeller) seen as either ruthless monopolists or economic innovators', '"Robber barons" (critical) and "captains of industry" (admiring) describe the same Gilded Age industrialists. The terms reflect debate about whether they built America or exploited workers and crushed competition.', 50, 2, 'analyze', 2, '["Are these compliments or insults?", "Why might the same people get opposite labels?"]'),

-- Immigration
('q_ss_ush_011', 'social_studies', 'ss_ush_7', 'topic_ss_ush_immigration', 'multiple_choice', 'What was "nativism" in American history?', '["Support for Native Americans", "Opposition to immigration and preference for native-born Americans", "Support for immigration", "A political party"]', 'Opposition to immigration and preference for native-born Americans', 'Nativism is opposition to immigration based on preference for native-born citizens. It has appeared repeatedly in US history, targeting different groups (Irish, Chinese, Italians, etc.) seen as threatening economically or culturally.', 40, 2, 'understand', 2, '["Is this pro- or anti-immigrant?", "Think about the word root: native"]'),

-- Civil Rights
('q_ss_ush_012', 'social_studies', 'ss_ush_8', 'topic_ss_ush_civil_rights', 'multiple_choice', 'How did the Civil Rights Movement use both legal and protest strategies?', '["Only used protests", "Combined legal challenges (NAACP lawsuits) with protests (boycotts, sit-ins, marches)", "Only used legal challenges", "Used violence"]', 'Combined legal challenges (NAACP lawsuits) with protests (boycotts, sit-ins, marches)', 'The Civil Rights Movement used multiple strategies: legal (Brown v. Board, NAACP), nonviolent protest (Montgomery Bus Boycott, sit-ins, Freedom Rides), and moral persuasion to challenge segregation and discrimination.', 45, 2, 'analyze', 2, '["What different methods did activists use?", "Think about courts AND streets"]'),

-- America as Global Power
('q_ss_ush_013', 'social_studies', 'ss_ush_9', 'topic_ss_ush_global_power', 'multiple_choice', 'How did World War II change America''s role in the world?', '["America became isolationist", "America emerged as a global superpower with military and economic dominance", "America withdrew from world affairs", "Nothing changed"]', 'America emerged as a global superpower with military and economic dominance', 'WWII transformed America from reluctant participant to global superpower: only major economy undamaged, nuclear weapons, military bases worldwide, creator of postwar institutions (UN, NATO, World Bank), and rival to Soviet Union.', 45, 2, 'analyze', 2, '["How did America''s power change?", "Think about before and after WWII"]'),

-- Progressive Era
('q_ss_ush_014', 'social_studies', 'ss_ush_10', 'topic_ss_ush_progressive', 'multiple_choice', 'What problems were "muckrakers" trying to expose?', '["Political corruption, corporate abuses, and terrible working/living conditions", "Foreign threats", "Religious differences", "Educational failures"]', 'Political corruption, corporate abuses, and terrible working/living conditions', 'Muckrakers were investigative journalists (Ida Tarbell, Upton Sinclair, Jacob Riis) who exposed corruption, monopolies, unsafe food, child labor, and slums, building public support for Progressive reforms.', 40, 2, 'understand', 2, '["What did journalists investigate?", "What needed reform?"]'),

-- Great Depression
('q_ss_ush_015', 'social_studies', 'ss_ush_11', 'topic_ss_ush_depression', 'multiple_choice', 'How did the New Deal change the role of the federal government?', '["Reduced government involvement in economy", "Greatly expanded federal role in economy, welfare, and regulation", "Eliminated all government programs", "No significant change"]', 'Greatly expanded federal role in economy, welfare, and regulation', 'The New Deal fundamentally expanded federal government: created Social Security, unemployment insurance, labor regulations, banking oversight, and public works. Established expectation that government should manage economy and provide social safety net.', 50, 2, 'analyze', 2, '["Did government grow or shrink?", "What new programs were created?"]');

-- ============================================================================
-- QUESTION BANK - US GOVERNMENT & CIVICS (20 questions)
-- CRITICAL FOR UTAH CIVICS TEST
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Constitution Fundamentals
('q_ss_gov_001', 'social_studies', 'ss_gov_1', 'topic_ss_gov_constitution', 'multiple_choice', 'What is the supreme law of the United States?', '["The Declaration of Independence", "The Constitution", "The Bill of Rights", "Federal laws"]', 'The Constitution', 'The Constitution is the supreme law - all other laws, treaties, and government actions must comply with it. This principle is called constitutional supremacy.', 25, 1, 'remember', 1, '["What document establishes the government?", "What is the highest law?"]'),

('q_ss_gov_002', 'social_studies', 'ss_gov_1', 'topic_ss_gov_constitution', 'multiple_choice', 'What does the Constitution do?', '["Sets up the government", "Defines powers of government", "Protects basic rights of Americans", "All of the above"]', 'All of the above', 'The Constitution establishes government structure (three branches), defines and limits government powers, and protects individual rights (especially in amendments). It''s a framework for governance.', 30, 1, 'understand', 1, '["What is the Constitution''s purpose?", "Think about government structure and rights"]'),

('q_ss_gov_003', 'social_studies', 'ss_gov_1', 'topic_ss_gov_constitution', 'multiple_choice', 'What is an amendment?', '["A change or addition to the Constitution", "A law passed by Congress", "A court decision", "A presidential order"]', 'A change or addition to the Constitution', 'An amendment is a formal change or addition to the Constitution. The amendment process (Article V) is intentionally difficult, requiring supermajorities, to ensure stability.', 30, 1, 'remember', 1, '["How does the Constitution change?", "What is a formal change called?"]'),

('q_ss_gov_004', 'social_studies', 'ss_gov_1', 'topic_ss_gov_constitution', 'multiple_choice', 'What are the first ten amendments to the Constitution called?', '["The Preamble", "The Articles", "The Bill of Rights", "The Declaration of Rights"]', 'The Bill of Rights', 'The first ten amendments (1791) are called the Bill of Rights. They protect fundamental liberties like speech, religion, press, and fair trials.', 25, 1, 'remember', 1, '["What protects basic freedoms?", "What are amendments 1-10 called?"]'),

-- Three Branches
('q_ss_gov_005', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'What are the three branches of government?', '["Executive, Legislative, Judicial", "President, Congress, Courts", "Federal, State, Local", "House, Senate, President"]', 'Executive, Legislative, Judicial', 'The Constitution creates three branches: Legislative (makes laws), Executive (enforces laws), and Judicial (interprets laws). This separation prevents power concentration.', 25, 1, 'remember', 1, '["How is government divided?", "What are the three parts?"]'),

('q_ss_gov_006', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'What does the legislative branch do?', '["Enforces laws", "Makes/passes laws", "Interprets laws", "Commands the military"]', 'Makes/passes laws', 'The legislative branch (Congress: House and Senate) makes federal laws. Both chambers must pass a bill, then the President signs or vetoes it.', 30, 1, 'remember', 1, '["Which branch makes laws?", "What does Congress do?"]'),

('q_ss_gov_007', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'Who is in charge of the executive branch?', '["Congress", "The President", "The Supreme Court", "The Cabinet"]', 'The President', 'The President heads the executive branch, which enforces laws, commands military, conducts foreign policy, and runs federal agencies.', 25, 1, 'remember', 1, '["Who runs the executive branch?", "Who enforces laws?"]'),

('q_ss_gov_008', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'What does the judicial branch do?', '["Makes laws", "Interprets/explains laws and applies them to cases", "Enforces laws", "Collects taxes"]', 'Interprets/explains laws and applies them to cases', 'The judicial branch (Supreme Court and federal courts) interprets laws, applies them to specific cases, and can declare laws unconstitutional.', 30, 1, 'remember', 1, '["What do courts do?", "Who explains what laws mean?"]'),

('q_ss_gov_009', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'What is the highest court in the United States?', '["Federal Court", "Court of Appeals", "The Supreme Court", "District Court"]', 'The Supreme Court', 'The Supreme Court is the highest court, with final authority on constitutional interpretation. Its decisions set precedents for all lower courts.', 25, 1, 'remember', 1, '["What court is most powerful?", "What court makes final decisions?"]'),

('q_ss_gov_010', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'How many U.S. Senators are there?', '["50", "100", "435", "538"]', '100', 'There are 100 Senators: 2 from each of the 50 states, serving 6-year terms. This gives small states equal representation in the Senate.', 25, 1, 'remember', 1, '["How many states?", "How many Senators per state?"]'),

('q_ss_gov_011', 'social_studies', 'ss_gov_2', 'topic_ss_gov_branches', 'multiple_choice', 'How many voting members are in the House of Representatives?', '["50", "100", "435", "538"]', '435', 'There are 435 Representatives, distributed among states by population. States with more people get more representatives (proportional representation).', 30, 1, 'remember', 1, '["Is this number fixed?", "Is it more or less than Senators?"]'),

-- Checks and Balances
('q_ss_gov_012', 'social_studies', 'ss_gov_3', 'topic_ss_gov_checks', 'multiple_choice', 'How can Congress check the President''s power?', '["Refuse to confirm appointments", "Override vetoes with 2/3 vote", "Impeach and remove from office", "All of the above"]', 'All of the above', 'Congress checks the President through: confirming appointments (Senate), overriding vetoes, controlling budget, and impeachment. This prevents executive overreach.', 40, 2, 'understand', 2, '["What powers does Congress have over President?", "Think about multiple checks"]'),

('q_ss_gov_013', 'social_studies', 'ss_gov_3', 'topic_ss_gov_checks', 'multiple_choice', 'How can the President check Congress?', '["Veto bills passed by Congress", "Dissolve Congress", "Write laws directly", "Fire members of Congress"]', 'Veto bills passed by Congress', 'The President can veto (reject) bills passed by Congress, forcing them to get 2/3 vote to override. The President cannot dissolve Congress, fire members, or write laws.', 35, 2, 'understand', 2, '["What can the President do to bills?", "The President can reject but not write laws"]'),

('q_ss_gov_014', 'social_studies', 'ss_gov_3', 'topic_ss_gov_checks', 'multiple_choice', 'How can the Supreme Court check Congress and the President?', '["Declare laws or actions unconstitutional (judicial review)", "Veto laws", "Impeach officials", "Write new laws"]', 'Declare laws or actions unconstitutional (judicial review)', 'The Supreme Court checks other branches through judicial review: declaring laws or executive actions unconstitutional. This power, established in Marbury v. Madison, is the judiciary''s main check.', 45, 2, 'understand', 2, '["What is the Court''s main power?", "What can courts do to laws?"]'),

-- Federalism
('q_ss_gov_015', 'social_studies', 'ss_gov_4', 'topic_ss_gov_federalism', 'multiple_choice', 'What is federalism?', '["Power divided between national and state governments", "One strong national government", "Independent state governments only", "International cooperation"]', 'Power divided between national and state governments', 'Federalism is the constitutional division of power between the federal (national) government and state governments. Each has areas of authority, with federal law supreme in conflicts.', 40, 2, 'understand', 2, '["How is power divided vertically?", "What is the relationship between national and state?"]'),

('q_ss_gov_016', 'social_studies', 'ss_gov_4', 'topic_ss_gov_federalism', 'multiple_choice', 'What is one power of the federal government?', '["To print money", "To issue driver''s licenses", "To create local governments", "To conduct elections"]', 'To print money', 'Federal powers (enumerated in Constitution) include: print money, declare war, create military, make treaties, regulate interstate commerce. States cannot do these.', 30, 1, 'remember', 1, '["What can only the national government do?", "Think about money, military, foreign policy"]'),

('q_ss_gov_017', 'social_studies', 'ss_gov_4', 'topic_ss_gov_federalism', 'multiple_choice', 'What is one power of the states?', '["Declare war", "Print money", "Provide schooling and education", "Make treaties"]', 'Provide schooling and education', 'State powers (reserved by 10th Amendment) include: education, marriage/divorce laws, driver licenses, professional licensing. These are "police powers" - protecting public health, safety, and welfare.', 30, 1, 'remember', 1, '["What do states control?", "Think about schools, licenses, local matters"]'),

-- Bill of Rights
('q_ss_gov_018', 'social_studies', 'ss_gov_5', 'topic_ss_gov_bill_rights', 'multiple_choice', 'What does the First Amendment protect?', '["Right to bear arms", "Freedom of speech, religion, press, assembly, and petition", "Right to trial by jury", "Protection from unreasonable searches"]', 'Freedom of speech, religion, press, assembly, and petition', 'The First Amendment protects five freedoms: speech, religion, press, assembly, and petition. These are considered fundamental to democratic participation.', 35, 2, 'remember', 1, '["What are the five freedoms?", "Think about expression and political participation"]'),

('q_ss_gov_019', 'social_studies', 'ss_gov_5', 'topic_ss_gov_bill_rights', 'multiple_choice', 'What does the Second Amendment protect?', '["Freedom of speech", "Right to bear arms", "Freedom of religion", "Right to vote"]', 'Right to bear arms', 'The Second Amendment protects the right to keep and bear arms. Its interpretation (individual vs. collective right, regulation extent) is debated.', 30, 1, 'remember', 1, '["Which amendment is about weapons?", "What is the right to bear?"]'),

('q_ss_gov_020', 'social_studies', 'ss_gov_5', 'topic_ss_gov_bill_rights', 'multiple_choice', 'What protections does the Fifth Amendment provide?', '["Right to remain silent (not self-incriminate)", "Protection from double jeopardy", "Right to due process", "All of the above"]', 'All of the above', 'The Fifth Amendment provides multiple protections: right to remain silent (no self-incrimination), no double jeopardy (tried twice for same crime), due process, grand jury indictment for serious crimes, and fair compensation for government takings.', 45, 2, 'remember', 2, '["What protections in criminal proceedings?", "What does \"plead the Fifth\" mean?"]');

-- ============================================================================
-- QUESTION BANK - SYSTEMS THINKING (10 questions)
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Causation
('q_ss_sys_001', 'social_studies', 'ss_sys_1', 'topic_ss_sys_causation', 'multiple_choice', 'What is the difference between an immediate cause and a long-term cause?', '["They are the same thing", "Immediate causes are triggers; long-term causes are underlying conditions that make events possible", "Immediate causes are more important", "Long-term causes happen first chronologically"]', 'Immediate causes are triggers; long-term causes are underlying conditions that make events possible', 'The assassination of Archduke Ferdinand was the immediate cause (trigger) of WWI, but long-term causes (militarism, alliances, imperialism, nationalism) created conditions where war was likely. Both matter.', 50, 3, 'analyze', 3, '["Think about spark vs kindling", "What triggers vs what enables?"]'),

('q_ss_sys_002', 'social_studies', 'ss_sys_1', 'topic_ss_sys_causation', 'multiple_choice', 'Why is "correlation doesn''t mean causation" important in history?', '["Correlation and causation are the same", "Things can happen together without one causing the other; coincidence or common cause", "Correlation is never important", "Only causation matters"]', 'Things can happen together without one causing one causing the other; coincidence or common cause', 'Just because two things happen together doesn''t mean one caused the other. They might be coincidence, or both caused by a third factor. Historians must find evidence of actual causal mechanisms.', 55, 3, 'evaluate', 3, '["Can things happen together by chance?", "What evidence is needed beyond timing?"]'),

-- Feedback Loops
('q_ss_sys_003', 'social_studies', 'ss_sys_2', 'topic_ss_sys_feedback', 'multiple_choice', 'What is a "reinforcing feedback loop" (snowball effect)?', '["A process that stabilizes a system", "A process where change feeds back to create more change in the same direction", "A process that reverses change", "Random fluctuations"]', 'A process where change feeds back to create more change in the same direction', 'Reinforcing loops amplify change: success breeds success, or failure breeds failure. Example: bank runs (fear causes withdrawals, causing bank failure, causing more fear). Also called vicious or virtuous cycles.', 60, 4, 'understand', 2, '["Does change amplify or stabilize?", "Think about snowballs rolling downhill"]'),

('q_ss_sys_004', 'social_studies', 'ss_sys_2', 'topic_ss_sys_feedback', 'multiple_choice', 'What is a "balancing feedback loop"?', '["A process that amplifies change", "A process that resists change and maintains stability", "A process that eliminates all change", "Random events"]', 'A process that resists change and maintains stability', 'Balancing loops stabilize systems by counteracting change: thermostats, supply/demand equilibrium, immune responses. When pushed from equilibrium, forces push back toward balance.', 60, 4, 'understand', 2, '["Does this create stability or instability?", "Think about thermostats"]'),

-- Unintended Consequences
('q_ss_sys_005', 'social_studies', 'ss_sys_3', 'topic_ss_sys_unintended', 'multiple_choice', 'Why did Prohibition (banning alcohol 1920-1933) have unintended consequences?', '["It worked perfectly", "Created organized crime networks, dangerous unregulated alcohol, and corruption", "It had no effects", "Everyone stopped drinking"]', 'Created organized crime networks, dangerous unregulated alcohol, and corruption', 'Prohibition intended to reduce drinking and social problems but created massive black markets, organized crime (Al Capone), dangerous bootleg alcohol, and police corruption. Demand didn''t disappear - it went underground.', 50, 3, 'analyze', 3, '["What happens when you ban something people want?", "Did demand disappear?"]'),

('q_ss_sys_006', 'social_studies', 'ss_sys_3', 'topic_ss_sys_unintended', 'multiple_choice', 'What is "Cobra Effect" - and what does it teach about unintended consequences?', '["Cobras becoming endangered", "Incentives can backfire when people game the system (bounty on cobras led to cobra breeding)", "Successful pest control", "Random effects"]', 'Incentives can backfire when people game the system (bounty on cobras led to cobra breeding)', 'British India put bounty on cobras. People bred cobras to collect bounties. When bounty ended, breeders released cobras, making problem worse. Lesson: people respond to incentives in unexpected ways, especially when they can game the system.', 60, 3, 'analyze', 3, '["How might people exploit the bounty?", "Think about perverse incentives"]'),

-- Network Effects
('q_ss_sys_007', 'social_studies', 'ss_sys_4', 'topic_ss_sys_networks', 'multiple_choice', 'What is a "network effect"?', '["Networks of computers", "Something becomes more valuable as more people use it", "Networks having no effect", "Only technical systems"]', 'Something becomes more valuable as more people use it', 'Network effects mean value increases with users: telephones, social media, languages. First adopters get little value, but reaching critical mass creates self-reinforcing growth. Winner-take-all dynamics common.', 55, 4, 'understand', 2, '["How does value relate to number of users?", "Why is Facebook valuable?"]'),

-- Path Dependence
('q_ss_sys_008', 'social_studies', 'ss_sys_5', 'topic_ss_sys_path', 'multiple_choice', 'What is "path dependence"?', '["Following the same path every day", "Past institutional choices constrain future options, even when better alternatives exist", "Always taking the best path", "Random choices"]', 'Past institutional choices constrain future options, even when better alternatives exist', 'Path dependence means early decisions create lock-in, making change costly even when superior alternatives exist. Example: QWERTY keyboard (designed to slow typing) persists because everyone learned it and switching costs are high.', 65, 4, 'understand', 2, '["How does the past constrain the future?", "Why do suboptimal systems persist?"]'),

-- Social Change
('q_ss_sys_009', 'social_studies', 'ss_sys_6', 'topic_ss_sys_change', 'multiple_choice', 'What is a "tipping point" in social change?', '["The end of change", "The moment when gradual changes suddenly accelerate and become self-sustaining", "The beginning of change", "A random event"]', 'The moment when gradual changes suddenly accelerate and become self-sustaining', 'Tipping points occur when accumulated gradual changes suddenly cascade: civil rights movement, fall of communism, #MeToo. Small changes build pressure until a threshold is crossed and rapid transformation occurs.', 60, 3, 'understand', 2, '["When does gradual become sudden?", "Think about water boiling"]'),

('q_ss_sys_010', 'social_studies', 'ss_sys_6', 'topic_ss_sys_change', 'multiple_choice', 'What is "punctuated equilibrium" in social change?', '["Constant gradual change", "Long periods of stability interrupted by rapid bursts of change", "No change ever occurs", "Only gradual change matters"]', 'Long periods of stability interrupted by rapid bursts of change', 'Punctuated equilibrium describes pattern of long stable periods interrupted by brief revolutionary transformations. Most of the time institutions are stable (equilibrium), but crises or accumulated pressures create rapid change (punctuation).', 60, 3, 'understand', 2, '["Is change constant or episodic?", "Stability interrupted by what?"]');

-- ============================================================================
-- QUESTION BANK - HISTORIOGRAPHY (10 questions)
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- Sources
('q_ss_his_001', 'social_studies', 'ss_his_1', 'topic_ss_his_sources', 'multiple_choice', 'Which is a PRIMARY source about the American Revolution?', '["A 2020 history textbook", "A letter written by George Washington in 1776", "A documentary film from 2015", "A modern historian''s analysis"]', 'A letter written by George Washington in 1776', 'Primary sources are firsthand accounts from the time period studied: letters, diaries, official documents, artifacts. Washington''s letter is primary; modern accounts are secondary.', 35, 2, 'apply', 2, '["What was created during the event?", "Think about firsthand vs later interpretation"]'),

('q_ss_his_002', 'social_studies', 'ss_his_1', 'topic_ss_his_sources', 'multiple_choice', 'Why are primary sources not always more reliable than secondary sources?', '["They are always more reliable", "Primary sources can be biased, incomplete, or misleading; secondary sources can provide analysis and context", "Primary sources are never reliable", "Only secondary sources matter"]', 'Primary sources can be biased, incomplete, or misleading; secondary sources can provide analysis and context', 'Primary sources are valuable but not inherently reliable: authors have biases, limited perspectives, may lie or be mistaken. Good secondary sources synthesize multiple primary sources, provide context, and analyze critically.', 55, 3, 'evaluate', 3, '["Are firsthand accounts always accurate?", "What do historians add?"]'),

-- Bias
('q_ss_his_003', 'social_studies', 'ss_his_2', 'topic_ss_his_bias', 'multiple_choice', 'How can you detect bias in a historical source?', '["Check author''s background and interests", "Look for loaded language and emotional appeals", "Notice what is emphasized and what is omitted", "All of the above"]', 'All of the above', 'Detecting bias requires examining: who wrote it and why, language choices (neutral vs loaded), what''s emphasized/omitted, and comparison with other sources. All sources have perspective - the question is recognizing it.', 50, 3, 'analyze', 3, '["What reveals author perspective?", "Think about multiple indicators"]'),

('q_ss_his_004', 'social_studies', 'ss_his_2', 'topic_ss_his_bias', 'multiple_choice', 'Why is bias in historical sources not necessarily a problem?', '["Bias is always a problem", "Understanding the bias helps us understand the author''s perspective and context", "Bias makes sources useless", "Only unbiased sources matter"]', 'Understanding the bias helps us understand the author''s perspective and context', 'All sources have perspective - that''s not a flaw, it''s information. Bias becomes a problem only when unrecognized. Understanding an author''s perspective helps us interpret their account and understand their historical moment.', 55, 3, 'evaluate', 3, '["Is all bias bad?", "What can bias teach us?"]'),

-- Perspective
('q_ss_his_005', 'social_studies', 'ss_his_3', 'topic_ss_his_perspective', 'multiple_choice', 'Why might Native Americans and European settlers describe the same events very differently?', '["One group is lying", "Different positions create different experiences and interpretations of events", "Europeans wrote better", "Random chance"]', 'Different positions create different experiences and interpretations of events', 'Same events can be experienced completely differently depending on one''s position: settlers saw expansion and opportunity; Native Americans saw invasion and dispossession. Both perspectives are historically valid and necessary for understanding.', 50, 3, 'analyze', 3, '["How does position affect experience?", "Can both be true from different viewpoints?"]'),

('q_ss_his_006', 'social_studies', 'ss_his_3', 'topic_ss_his_perspective', 'multiple_choice', 'What does it mean that "history is written by the victors"?', '["Winners write more books", "Those in power control historical narratives, marginalizing other perspectives", "Losers don''t remember events", "Winners are always right"]', 'Those in power control historical narratives, marginalizing other perspectives', 'Those in power shape dominant narratives, determining what events matter, whose stories are told, and how events are interpreted. This means many voices (enslaved people, indigenous peoples, women, the poor) are marginalized or missing from traditional histories.', 55, 3, 'analyze', 3, '["Who controls the story?", "Whose perspectives might be missing?"]'),

-- Evidence Evaluation
('q_ss_his_007', 'social_studies', 'ss_his_4', 'topic_ss_his_evidence', 'multiple_choice', 'What does "corroboration" mean in evaluating historical evidence?', '["Using one source only", "Comparing multiple sources to see if they agree or provide different perspectives", "Ignoring conflicting evidence", "Accepting the first source found"]', 'Comparing multiple sources to see if they agree or provide different perspectives', 'Corroboration means checking whether multiple independent sources agree. Agreement increases confidence (though all could share same bias); disagreement reveals different perspectives or disputed facts needing further investigation.', 50, 3, 'understand', 2, '["How do you verify claims?", "What does checking multiple sources do?"]'),

('q_ss_his_008', 'social_studies', 'ss_his_4', 'topic_ss_his_evidence', 'multiple_choice', 'What is "sourcing" a historical document?', '["Reading it", "Identifying who created it, when, where, why, and for whom", "Citing it properly", "Copying it"]', 'Identifying who created it, when, where, why, and for whom', 'Sourcing means establishing a document''s origins: Who created it? When and where? For what purpose and audience? This context is essential for interpretation - a private diary differs from public propaganda.', 45, 3, 'understand', 2, '["What context do you need?", "What questions about document origins?"]'),

-- Competing Narratives
('q_ss_his_009', 'social_studies', 'ss_his_5', 'topic_ss_his_narratives', 'multiple_choice', 'Why do historians disagree about interpretation of the same events?', '["Some historians are wrong", "Different values, questions, evidence emphasis, and theoretical frameworks lead to different interpretations", "Historical facts are unclear", "Random disagreement"]', 'Different values, questions, evidence emphasis, and theoretical frameworks lead to different interpretations', 'Historiographical debates arise from: asking different questions, emphasizing different evidence, applying different theoretical lenses (economic, cultural, gender analysis), and having different values. Same facts support multiple interpretations.', 60, 4, 'analyze', 3, '["Why might smart people disagree?", "Think about questions and frameworks"]'),

-- Presentism
('q_ss_his_010', 'social_studies', 'ss_his_6', 'topic_ss_his_presentism', 'multiple_choice', 'What is "presentism" and why is it a problem for historians?', '["Focusing only on the present", "Judging past societies solely by current values rather than understanding them in their context", "Ignoring the present", "Connecting past to present"]', 'Judging past societies solely by current values rather than understanding them in their context', 'Presentism means imposing modern values on the past. While moral judgment has a place, historians first must understand past societies on their own terms - what values, beliefs, and constraints shaped their actions. Understanding ≠ excusing.', 60, 3, 'evaluate', 3, '["Should we judge past by present standards?", "What comes before judgment?"]');

-- ============================================================================
-- SKILL PREREQUISITES - SOCIAL STUDIES
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  -- Geography prerequisites
  ('prereq_ss_geo_001', 'topic_ss_geo_adaptation', 'topic', 'topic_ss_geo_physical', 'topic', 'required'),
  ('prereq_ss_geo_002', 'topic_ss_geo_climate_culture', 'topic', 'topic_ss_geo_physical', 'topic', 'required'),
  ('prereq_ss_geo_003', 'topic_ss_geo_resources', 'topic', 'topic_ss_geo_physical', 'topic', 'recommended'),
  ('prereq_ss_geo_004', 'topic_ss_geo_globalization', 'topic', 'topic_ss_geo_economic', 'topic', 'recommended'),

  -- World History prerequisites
  ('prereq_ss_whi_001', 'topic_ss_whi_trade', 'topic', 'topic_ss_whi_agriculture', 'topic', 'recommended'),
  ('prereq_ss_whi_002', 'topic_ss_whi_industrial', 'topic', 'topic_ss_whi_agriculture', 'topic', 'recommended'),
  ('prereq_ss_whi_003', 'topic_ss_whi_colonialism', 'topic', 'topic_ss_whi_industrial', 'topic', 'recommended'),
  ('prereq_ss_whi_004', 'topic_ss_whi_20th', 'topic', 'topic_ss_whi_colonialism', 'topic', 'recommended'),

  -- US History prerequisites
  ('prereq_ss_ush_001', 'topic_ss_ush_constitution', 'topic', 'topic_ss_ush_founding', 'topic', 'required'),
  ('prereq_ss_ush_002', 'topic_ss_ush_slavery', 'topic', 'topic_ss_ush_expansion', 'topic', 'recommended'),
  ('prereq_ss_ush_003', 'topic_ss_ush_civil_war', 'topic', 'topic_ss_ush_slavery', 'topic', 'required'),
  ('prereq_ss_ush_004', 'topic_ss_ush_industrial', 'topic', 'topic_ss_ush_civil_war', 'topic', 'recommended'),
  ('prereq_ss_ush_005', 'topic_ss_ush_progressive', 'topic', 'topic_ss_ush_industrial', 'topic', 'required'),

  -- Government prerequisites
  ('prereq_ss_gov_001', 'topic_ss_gov_branches', 'topic', 'topic_ss_gov_constitution', 'topic', 'required'),
  ('prereq_ss_gov_002', 'topic_ss_gov_checks', 'topic', 'topic_ss_gov_branches', 'topic', 'required'),
  ('prereq_ss_gov_003', 'topic_ss_gov_federalism', 'topic', 'topic_ss_gov_constitution', 'topic', 'required'),
  ('prereq_ss_gov_004', 'topic_ss_gov_bill_rights', 'topic', 'topic_ss_gov_constitution', 'topic', 'required'),

  -- Systems Thinking prerequisites
  ('prereq_ss_sys_001', 'topic_ss_sys_feedback', 'topic', 'topic_ss_sys_causation', 'topic', 'recommended'),
  ('prereq_ss_sys_002', 'topic_ss_sys_unintended', 'topic', 'topic_ss_sys_causation', 'topic', 'recommended'),
  ('prereq_ss_sys_003', 'topic_ss_sys_networks', 'topic', 'topic_ss_sys_feedback', 'topic', 'recommended'),
  ('prereq_ss_sys_004', 'topic_ss_sys_change', 'topic', 'topic_ss_sys_feedback', 'topic', 'recommended'),

  -- Historiography prerequisites
  ('prereq_ss_his_001', 'topic_ss_his_bias', 'topic', 'topic_ss_his_sources', 'topic', 'required'),
  ('prereq_ss_his_002', 'topic_ss_his_perspective', 'topic', 'topic_ss_his_bias', 'topic', 'recommended'),
  ('prereq_ss_his_003', 'topic_ss_his_evidence', 'topic', 'topic_ss_his_sources', 'topic', 'required'),
  ('prereq_ss_his_004', 'topic_ss_his_narratives', 'topic', 'topic_ss_his_evidence', 'topic', 'required'),
  ('prereq_ss_his_005', 'topic_ss_his_presentism', 'topic', 'topic_ss_his_perspective', 'topic', 'recommended');
