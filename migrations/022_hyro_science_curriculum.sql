-- HYRO FORGE: Science Curriculum
-- Migration 022: NGSS-Aligned Middle School Science
-- Covers: Life Science, Earth Science, Physical Science, Scientific Practices
-- Utah SEEd Standards alignment with extensions

-- ============================================================================
-- SCIENTIFIC PRACTICES & ENGINEERING STANDARDS (Cross-cutting)
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('sci_sep_1', 'science', 'ngss', 'SEP.1', 'Asking Questions', 'Ask questions that arise from observations, models, or unexpected results to clarify and seek additional information.', NULL, 'middle', 'Scientific Practices', 'Practices', 1, 1),
  ('sci_sep_2', 'science', 'ngss', 'SEP.2', 'Developing Models', 'Develop, use, and revise models to describe, test, and predict phenomena.', NULL, 'middle', 'Scientific Practices', 'Practices', 2, 1),
  ('sci_sep_3', 'science', 'ngss', 'SEP.3', 'Planning Investigations', 'Plan and conduct an investigation to produce data to serve as the basis for evidence.', NULL, 'middle', 'Scientific Practices', 'Practices', 3, 1),
  ('sci_sep_4', 'science', 'ngss', 'SEP.4', 'Analyzing Data', 'Analyze and interpret data to provide evidence for phenomena.', NULL, 'middle', 'Scientific Practices', 'Practices', 4, 1),
  ('sci_sep_5', 'science', 'ngss', 'SEP.5', 'Using Mathematics', 'Use mathematical and computational thinking to analyze data and support explanations.', NULL, 'middle', 'Scientific Practices', 'Practices', 5, 1),
  ('sci_sep_6', 'science', 'ngss', 'SEP.6', 'Constructing Explanations', 'Construct an explanation using models and evidence.', NULL, 'middle', 'Scientific Practices', 'Practices', 6, 1),
  ('sci_sep_7', 'science', 'ngss', 'SEP.7', 'Engaging in Argument', 'Engage in argument from evidence using reasoning and data.', NULL, 'middle', 'Scientific Practices', 'Practices', 7, 1),
  ('sci_sep_8', 'science', 'ngss', 'SEP.8', 'Communicating Information', 'Obtain, evaluate, and communicate information clearly and effectively.', NULL, 'middle', 'Scientific Practices', 'Practices', 8, 1);

-- ============================================================================
-- LIFE SCIENCE STANDARDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Structure and Function
  ('sci_ls_1a', 'science', 'ngss', 'MS-LS1-1', 'Cell Theory', 'Conduct an investigation to provide evidence that living things are made of cells; either one cell or many different numbers and types of cells.', 6, 'middle', 'Life Science', 'Structure and Function', 10, 1),
  ('sci_ls_1b', 'science', 'ngss', 'MS-LS1-2', 'Cell Functions', 'Develop and use a model to describe the function of a cell as a whole and ways parts of cells contribute to the function.', 6, 'middle', 'Life Science', 'Structure and Function', 11, 1),
  ('sci_ls_1c', 'science', 'ngss', 'MS-LS1-3', 'Body Systems', 'Use argument supported by evidence for how the body is a system of interacting subsystems composed of groups of cells.', 6, 'middle', 'Life Science', 'Structure and Function', 12, 1),
  ('sci_ls_1d', 'science', 'ngss', 'MS-LS1-4', 'Animal Behavior', 'Use argument based on empirical evidence and scientific reasoning to support an explanation for how characteristic animal behaviors affect survival.', 6, 'middle', 'Life Science', 'Structure and Function', 13, 1),
  ('sci_ls_1e', 'science', 'ngss', 'MS-LS1-5', 'Environmental Factors', 'Construct a scientific explanation based on evidence for how environmental and genetic factors influence the growth of organisms.', 6, 'middle', 'Life Science', 'Structure and Function', 14, 1),
  ('sci_ls_1f', 'science', 'ngss', 'MS-LS1-6', 'Photosynthesis', 'Construct a scientific explanation based on evidence for the role of photosynthesis in the cycling of matter and flow of energy into and out of organisms.', 6, 'middle', 'Life Science', 'Matter and Energy', 15, 1),
  ('sci_ls_1g', 'science', 'ngss', 'MS-LS1-7', 'Cellular Respiration', 'Develop a model to describe how food is rearranged through chemical reactions forming new molecules that support growth.', 6, 'middle', 'Life Science', 'Matter and Energy', 16, 1),

  -- Ecosystems
  ('sci_ls_2a', 'science', 'ngss', 'MS-LS2-1', 'Resource Competition', 'Analyze and interpret data to provide evidence for the effects of resource availability on organisms and populations in an ecosystem.', 6, 'middle', 'Life Science', 'Ecosystems', 20, 1),
  ('sci_ls_2b', 'science', 'ngss', 'MS-LS2-2', 'Ecological Relationships', 'Construct an explanation that predicts patterns of interactions among organisms across multiple ecosystems.', 6, 'middle', 'Life Science', 'Ecosystems', 21, 1),
  ('sci_ls_2c', 'science', 'ngss', 'MS-LS2-3', 'Matter and Energy Cycling', 'Develop a model to describe the cycling of matter and flow of energy among living and nonliving parts of an ecosystem.', 6, 'middle', 'Life Science', 'Ecosystems', 22, 1),
  ('sci_ls_2d', 'science', 'ngss', 'MS-LS2-4', 'Ecosystem Stability', 'Construct an argument supported by evidence that changes to physical or biological components of an ecosystem affect populations.', 6, 'middle', 'Life Science', 'Ecosystems', 23, 1),
  ('sci_ls_2e', 'science', 'ngss', 'MS-LS2-5', 'Biodiversity and Humans', 'Evaluate competing design solutions for maintaining biodiversity and ecosystem services.', 6, 'middle', 'Life Science', 'Ecosystems', 24, 1),

  -- Heredity
  ('sci_ls_3a', 'science', 'ngss', 'MS-LS3-1', 'Genetic Traits', 'Develop and use a model to describe why structural changes to genes (mutations) may result in harmful, beneficial, or neutral effects.', 7, 'middle', 'Life Science', 'Heredity', 30, 1),
  ('sci_ls_3b', 'science', 'ngss', 'MS-LS3-2', 'Sexual vs Asexual Reproduction', 'Develop and use a model to describe why asexual reproduction results in offspring with identical genetic information and sexual reproduction results in variation.', 7, 'middle', 'Life Science', 'Heredity', 31, 1),

  -- Evolution
  ('sci_ls_4a', 'science', 'ngss', 'MS-LS4-1', 'Fossil Record', 'Analyze and interpret data for patterns in the fossil record that document the existence, diversity, extinction, and change of life forms.', 7, 'middle', 'Life Science', 'Evolution', 35, 1),
  ('sci_ls_4b', 'science', 'ngss', 'MS-LS4-2', 'Anatomical Similarities', 'Apply scientific ideas to construct an explanation for the anatomical similarities and differences among modern organisms and between modern and fossil organisms.', 7, 'middle', 'Life Science', 'Evolution', 36, 1),
  ('sci_ls_4c', 'science', 'ngss', 'MS-LS4-3', 'Embryological Evidence', 'Analyze displays of pictorial data to compare patterns of similarities in the embryological development across multiple species.', 7, 'middle', 'Life Science', 'Evolution', 37, 1),
  ('sci_ls_4d', 'science', 'ngss', 'MS-LS4-4', 'Natural Selection', 'Construct an explanation based on evidence that describes how genetic variations of traits in a population increase some individuals'' probability of surviving and reproducing.', 7, 'middle', 'Life Science', 'Evolution', 38, 1),
  ('sci_ls_4e', 'science', 'ngss', 'MS-LS4-5', 'Artificial Selection', 'Gather and synthesize information about the technologies that have changed the way humans influence the inheritance of desired traits.', 7, 'middle', 'Life Science', 'Evolution', 39, 1),
  ('sci_ls_4f', 'science', 'ngss', 'MS-LS4-6', 'Adaptation', 'Use mathematical representations to support explanations of how natural selection may lead to increases and decreases of specific traits in populations over time.', 7, 'middle', 'Life Science', 'Evolution', 40, 1);

-- ============================================================================
-- PHYSICAL SCIENCE STANDARDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Matter and Its Interactions
  ('sci_ps_1a', 'science', 'ngss', 'MS-PS1-1', 'Atomic Structure', 'Develop models to describe the atomic composition of simple molecules and extended structures.', 6, 'middle', 'Physical Science', 'Matter', 50, 1),
  ('sci_ps_1b', 'science', 'ngss', 'MS-PS1-2', 'Physical and Chemical Properties', 'Analyze and interpret data on the properties of substances before and after the substances interact to determine if a chemical reaction has occurred.', 6, 'middle', 'Physical Science', 'Matter', 51, 1),
  ('sci_ps_1c', 'science', 'ngss', 'MS-PS1-3', 'Synthetic Materials', 'Gather and make sense of information to describe that synthetic materials come from natural resources and impact society.', 6, 'middle', 'Physical Science', 'Matter', 52, 1),
  ('sci_ps_1d', 'science', 'ngss', 'MS-PS1-4', 'Thermal Energy in Reactions', 'Develop a model that predicts and describes changes in particle motion, temperature, and state of a pure substance when thermal energy is added or removed.', 6, 'middle', 'Physical Science', 'Matter', 53, 1),
  ('sci_ps_1e', 'science', 'ngss', 'MS-PS1-5', 'Conservation of Matter', 'Develop and use a model to describe how the total number of atoms does not change in a chemical reaction and thus mass is conserved.', 6, 'middle', 'Physical Science', 'Matter', 54, 1),
  ('sci_ps_1f', 'science', 'ngss', 'MS-PS1-6', 'Endothermic and Exothermic', 'Undertake a design project to construct, test, and modify a device that either releases or absorbs thermal energy by chemical processes.', 6, 'middle', 'Physical Science', 'Matter', 55, 1),

  -- Motion and Stability
  ('sci_ps_2a', 'science', 'ngss', 'MS-PS2-1', 'Newton''s Third Law', 'Apply Newton''s Third Law to design a solution to a problem involving the motion of two colliding objects.', 7, 'middle', 'Physical Science', 'Forces and Motion', 60, 1),
  ('sci_ps_2b', 'science', 'ngss', 'MS-PS2-2', 'Balanced and Unbalanced Forces', 'Plan an investigation to provide evidence that the change in an object''s motion depends on the sum of the forces on the object and the mass of the object.', 7, 'middle', 'Physical Science', 'Forces and Motion', 61, 1),
  ('sci_ps_2c', 'science', 'ngss', 'MS-PS2-3', 'Electric and Magnetic Forces', 'Ask questions about data to determine the factors that affect the strength of electric and magnetic forces.', 7, 'middle', 'Physical Science', 'Forces and Motion', 62, 1),
  ('sci_ps_2d', 'science', 'ngss', 'MS-PS2-4', 'Gravitational Forces', 'Construct and present arguments using evidence to support the claim that gravitational interactions are attractive and depend on the masses of interacting objects.', 7, 'middle', 'Physical Science', 'Forces and Motion', 63, 1),
  ('sci_ps_2e', 'science', 'ngss', 'MS-PS2-5', 'Fields', 'Conduct an investigation and evaluate the experimental design to provide evidence that fields exist between objects exerting forces on each other.', 7, 'middle', 'Physical Science', 'Forces and Motion', 64, 1),

  -- Energy
  ('sci_ps_3a', 'science', 'ngss', 'MS-PS3-1', 'Kinetic Energy', 'Construct and interpret graphical displays of data to describe the relationships of kinetic energy to the mass of an object and to the speed of an object.', 8, 'middle', 'Physical Science', 'Energy', 70, 1),
  ('sci_ps_3b', 'science', 'ngss', 'MS-PS3-2', 'Potential Energy', 'Develop a model to describe that when the arrangement of objects interacting at a distance changes, different amounts of potential energy are stored in the system.', 8, 'middle', 'Physical Science', 'Energy', 71, 1),
  ('sci_ps_3c', 'science', 'ngss', 'MS-PS3-3', 'Thermal Energy Transfer', 'Apply scientific principles to design, construct, and test a device that either minimizes or maximizes thermal energy transfer.', 8, 'middle', 'Physical Science', 'Energy', 72, 1),
  ('sci_ps_3d', 'science', 'ngss', 'MS-PS3-4', 'Energy and Temperature', 'Plan an investigation to determine the relationships among the energy transferred, the type of matter, the mass, and the change in the average kinetic energy of particles.', 8, 'middle', 'Physical Science', 'Energy', 73, 1),
  ('sci_ps_3e', 'science', 'ngss', 'MS-PS3-5', 'Energy Conversion', 'Construct, use, and present arguments to support the claim that when the kinetic energy of an object changes, energy is transferred to or from the object.', 8, 'middle', 'Physical Science', 'Energy', 74, 1),

  -- Waves
  ('sci_ps_4a', 'science', 'ngss', 'MS-PS4-1', 'Wave Properties', 'Use mathematical representations to describe a simple model for waves that includes how the amplitude of a wave is related to the energy in a wave.', 8, 'middle', 'Physical Science', 'Waves', 80, 1),
  ('sci_ps_4b', 'science', 'ngss', 'MS-PS4-2', 'Wave Behavior', 'Develop and use a model to describe that waves are reflected, absorbed, or transmitted through various materials.', 8, 'middle', 'Physical Science', 'Waves', 81, 1),
  ('sci_ps_4c', 'science', 'ngss', 'MS-PS4-3', 'Digital Information', 'Integrate qualitative scientific and technical information to support the claim that digitized signals are a more reliable way to encode and transmit information than analog signals.', 8, 'middle', 'Physical Science', 'Waves', 82, 1);

-- ============================================================================
-- EARTH AND SPACE SCIENCE STANDARDS
-- ============================================================================

INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  -- Earth''s Place in the Universe
  ('sci_ess_1a', 'science', 'ngss', 'MS-ESS1-1', 'Earth-Sun-Moon System', 'Develop and use a model of the Earth-sun-moon system to describe the cyclic patterns of lunar phases, eclipses of the sun and moon, and seasons.', 6, 'middle', 'Earth Science', 'Space Systems', 90, 1),
  ('sci_ess_1b', 'science', 'ngss', 'MS-ESS1-2', 'Gravitational Forces in Space', 'Develop and use a model to describe the role of gravity in the motions within galaxies and the solar system.', 6, 'middle', 'Earth Science', 'Space Systems', 91, 1),
  ('sci_ess_1c', 'science', 'ngss', 'MS-ESS1-3', 'Scale of the Universe', 'Analyze and interpret data to determine scale properties of objects in the solar system.', 6, 'middle', 'Earth Science', 'Space Systems', 92, 1),
  ('sci_ess_1d', 'science', 'ngss', 'MS-ESS1-4', 'Earth''s History', 'Construct a scientific explanation based on evidence from rock strata for how the geologic time scale is used to organize Earth''s history.', 7, 'middle', 'Earth Science', 'Earth History', 93, 1),

  -- Earth''s Systems
  ('sci_ess_2a', 'science', 'ngss', 'MS-ESS2-1', 'Earth''s Interior', 'Develop a model to describe the cycling of Earth''s materials and the flow of energy that drives this process.', 7, 'middle', 'Earth Science', 'Earth Systems', 100, 1),
  ('sci_ess_2b', 'science', 'ngss', 'MS-ESS2-2', 'Plate Tectonics', 'Construct an explanation based on evidence for how geoscience processes have changed Earth''s surface at varying time and spatial scales.', 7, 'middle', 'Earth Science', 'Earth Systems', 101, 1),
  ('sci_ess_2c', 'science', 'ngss', 'MS-ESS2-3', 'Rock Cycle', 'Analyze and interpret data on the distribution of fossils and rocks, continental shapes, and seafloor structures to provide evidence of the past plate motions.', 7, 'middle', 'Earth Science', 'Earth Systems', 102, 1),
  ('sci_ess_2d', 'science', 'ngss', 'MS-ESS2-4', 'Water Cycle', 'Develop a model to describe the cycling of water through Earth''s systems driven by energy from the sun and the force of gravity.', 7, 'middle', 'Earth Science', 'Earth Systems', 103, 1),
  ('sci_ess_2e', 'science', 'ngss', 'MS-ESS2-5', 'Weather and Climate', 'Collect data to provide evidence for how the motions and complex interactions of air masses results in changes in weather conditions.', 7, 'middle', 'Earth Science', 'Earth Systems', 104, 1),
  ('sci_ess_2f', 'science', 'ngss', 'MS-ESS2-6', 'Climate Variation', 'Develop and use a model to describe how unequal heating and rotation of the Earth cause patterns of atmospheric and oceanic circulation.', 7, 'middle', 'Earth Science', 'Earth Systems', 105, 1),

  -- Earth and Human Activity
  ('sci_ess_3a', 'science', 'ngss', 'MS-ESS3-1', 'Natural Resources', 'Construct a scientific explanation based on evidence for how the uneven distributions of Earth''s mineral, energy, and groundwater resources are the result of past and current geoscience processes.', 8, 'middle', 'Earth Science', 'Human Impact', 110, 1),
  ('sci_ess_3b', 'science', 'ngss', 'MS-ESS3-2', 'Natural Hazards', 'Analyze and interpret data on natural hazards to forecast future catastrophic events and inform the development of technologies to mitigate their effects.', 8, 'middle', 'Earth Science', 'Human Impact', 111, 1),
  ('sci_ess_3c', 'science', 'ngss', 'MS-ESS3-3', 'Human Impact on Environment', 'Apply scientific principles to design a method for monitoring and minimizing a human impact on the environment.', 8, 'middle', 'Earth Science', 'Human Impact', 112, 1),
  ('sci_ess_3d', 'science', 'ngss', 'MS-ESS3-4', 'Human Population Growth', 'Construct an argument supported by evidence for how increases in human population and per-capita consumption of natural resources impact Earth''s systems.', 8, 'middle', 'Earth Science', 'Human Impact', 113, 1),
  ('sci_ess_3e', 'science', 'ngss', 'MS-ESS3-5', 'Climate Change', 'Ask questions to clarify evidence of the factors that have caused the rise in global temperatures over the past century.', 8, 'middle', 'Earth Science', 'Human Impact', 114, 1);

-- ============================================================================
-- CURRICULUM TOPICS - SCIENCE
-- ============================================================================

INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Scientific Method Topics
  ('topic_sci_scientific_questions', 'science', 'sci_sep_1', 'Asking Scientific Questions', 'How to formulate testable scientific questions', '["Distinguish testable from non-testable questions", "Formulate questions based on observations", "Refine questions to be specific and measurable"]', 1, 20),
  ('topic_sci_hypothesis', 'science', 'sci_sep_1', 'Forming Hypotheses', 'Developing predictions based on prior knowledge', '["Write if-then hypothesis statements", "Base hypotheses on prior knowledge", "Identify independent and dependent variables"]', 2, 25),
  ('topic_sci_models', 'science', 'sci_sep_2', 'Scientific Models', 'Using and creating models to understand phenomena', '["Explain the purpose of scientific models", "Identify limitations of models", "Create simple models to represent systems"]', 2, 30),
  ('topic_sci_experiments', 'science', 'sci_sep_3', 'Designing Experiments', 'Planning controlled investigations', '["Identify variables to control", "Design procedures that test hypotheses", "Determine appropriate sample sizes"]', 2, 35),
  ('topic_sci_data_analysis', 'science', 'sci_sep_4', 'Analyzing Scientific Data', 'Interpreting data from investigations', '["Create data tables and graphs", "Identify patterns in data", "Draw conclusions from evidence"]', 2, 30),
  ('topic_sci_evidence_reasoning', 'science', 'sci_sep_7', 'Evidence and Reasoning', 'Supporting claims with scientific evidence', '["Distinguish evidence from opinion", "Connect evidence to claims", "Evaluate strength of evidence"]', 2, 30),

  -- Life Science Topics
  ('topic_sci_cell_theory', 'science', 'sci_ls_1a', 'Cell Theory', 'The foundational principles of cell biology', '["State the three parts of cell theory", "Explain how cell theory developed", "Apply cell theory to living things"]', 1, 20),
  ('topic_sci_cell_types', 'science', 'sci_ls_1a', 'Types of Cells', 'Prokaryotic vs Eukaryotic cells', '["Compare prokaryotic and eukaryotic cells", "Identify examples of each type", "Explain the significance of cell membrane"]', 2, 25),
  ('topic_sci_cell_organelles', 'science', 'sci_ls_1b', 'Cell Organelles', 'Structure and function of cell parts', '["Identify major organelles", "Describe the function of each organelle", "Compare plant and animal cells"]', 2, 35),
  ('topic_sci_cell_processes', 'science', 'sci_ls_1b', 'Cellular Processes', 'How cells obtain energy and make proteins', '["Explain the role of mitochondria", "Describe how ribosomes make proteins", "Understand cell membrane transport"]', 2, 30),
  ('topic_sci_body_systems_intro', 'science', 'sci_ls_1c', 'Body Systems Overview', 'Introduction to human body systems', '["List the major body systems", "Explain basic functions of each system", "Understand systems work together"]', 1, 25),
  ('topic_sci_photosynthesis', 'science', 'sci_ls_1f', 'Photosynthesis', 'How plants convert light to chemical energy', '["Write the photosynthesis equation", "Identify inputs and outputs", "Explain where photosynthesis occurs"]', 2, 30),
  ('topic_sci_cellular_respiration', 'science', 'sci_ls_1g', 'Cellular Respiration', 'How cells release energy from food', '["Write the cellular respiration equation", "Compare to photosynthesis", "Explain the role of ATP"]', 2, 30),
  ('topic_sci_food_webs', 'science', 'sci_ls_2b', 'Food Webs and Energy Flow', 'How energy moves through ecosystems', '["Distinguish food chains from food webs", "Identify producers, consumers, decomposers", "Explain energy transfer between levels"]', 2, 30),
  ('topic_sci_natural_selection', 'science', 'sci_ls_4d', 'Natural Selection', 'The mechanism of evolution', '["Explain variation in populations", "Describe selective pressure", "Predict outcomes of natural selection"]', 3, 35),

  -- Physical Science Topics
  ('topic_sci_atomic_structure', 'science', 'sci_ps_1a', 'Atomic Structure', 'Components of atoms', '["Identify protons, neutrons, electrons", "Understand atomic number and mass", "Describe electron arrangement"]', 2, 30),
  ('topic_sci_elements_compounds', 'science', 'sci_ps_1a', 'Elements and Compounds', 'Pure substances and their combinations', '["Distinguish elements from compounds", "Read the periodic table", "Understand chemical formulas"]', 2, 25),
  ('topic_sci_chemical_reactions', 'science', 'sci_ps_1b', 'Chemical Reactions', 'How substances change', '["Identify signs of chemical change", "Balance simple equations", "Distinguish physical from chemical change"]', 2, 35),
  ('topic_sci_states_of_matter', 'science', 'sci_ps_1d', 'States of Matter', 'Solids, liquids, gases, and phase changes', '["Describe particle motion in each state", "Explain phase changes", "Interpret heating and cooling curves"]', 2, 25),
  ('topic_sci_forces_intro', 'science', 'sci_ps_2b', 'Forces and Motion', 'Newton''s Laws of Motion', '["State Newton''s three laws", "Calculate net force", "Apply laws to real situations"]', 2, 35),
  ('topic_sci_gravity', 'science', 'sci_ps_2d', 'Gravity', 'The force of attraction between masses', '["Explain what causes gravity", "Describe factors affecting gravitational force", "Calculate weight vs mass"]', 2, 25),
  ('topic_sci_energy_forms', 'science', 'sci_ps_3a', 'Forms of Energy', 'Different types of energy', '["Identify forms of energy", "Explain energy transformations", "Apply conservation of energy"]', 2, 30),
  ('topic_sci_waves_intro', 'science', 'sci_ps_4a', 'Wave Properties', 'Characteristics of waves', '["Define wavelength, frequency, amplitude", "Calculate wave speed", "Distinguish transverse from longitudinal"]', 2, 30),

  -- Earth Science Topics
  ('topic_sci_earth_sun_moon', 'science', 'sci_ess_1a', 'Earth-Sun-Moon System', 'Motions and their effects', '["Explain day, year, seasons", "Describe moon phases", "Understand eclipses"]', 2, 35),
  ('topic_sci_solar_system', 'science', 'sci_ess_1c', 'Solar System', 'Structure of our solar system', '["Order the planets", "Compare inner and outer planets", "Describe other solar system objects"]', 1, 25),
  ('topic_sci_plate_tectonics', 'science', 'sci_ess_2b', 'Plate Tectonics', 'Movement of Earth''s crust', '["Identify tectonic plates", "Describe plate boundaries", "Explain resulting features"]', 2, 35),
  ('topic_sci_rock_cycle', 'science', 'sci_ess_2c', 'Rock Cycle', 'Formation and transformation of rocks', '["Classify rock types", "Describe rock formation processes", "Explain the rock cycle"]', 2, 30),
  ('topic_sci_water_cycle', 'science', 'sci_ess_2d', 'Water Cycle', 'Movement of water through Earth systems', '["Identify water cycle stages", "Explain energy role in water cycle", "Describe human impacts"]', 1, 25),
  ('topic_sci_weather', 'science', 'sci_ess_2e', 'Weather and Climate', 'Atmospheric conditions and patterns', '["Distinguish weather from climate", "Identify weather factors", "Read weather maps"]', 2, 30),
  ('topic_sci_climate_change', 'science', 'sci_ess_3e', 'Climate Change', 'Causes and effects of global warming', '["Explain the greenhouse effect", "Identify human contributions", "Describe potential impacts"]', 3, 35);

-- ============================================================================
-- QUESTION BANK - SCIENCE
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES
  -- Scientific Method Questions
  ('q_sci_method_001', 'science', 'sci_sep_1', 'topic_sci_scientific_questions', 'multiple_choice', 'Which is a testable scientific question?', '["Why do birds sing?", "What is the best color?", "Does fertilizer affect plant growth?", "Is pizza delicious?"]', 'Does fertilizer affect plant growth?', 'A testable question can be investigated through observation or experiment and has measurable outcomes. "Does fertilizer affect plant growth?" can be tested by measuring plant growth with and without fertilizer.', 30, 2, 'analyze', 2, '["Can you measure the outcome?", "Can you design an experiment to test it?"]'),

  ('q_sci_method_002', 'science', 'sci_sep_1', 'topic_sci_hypothesis', 'multiple_choice', 'What is the independent variable in an experiment testing whether sunlight affects plant growth?', '["Plant height", "Amount of water", "Amount of sunlight", "Soil type"]', 'Amount of sunlight', 'The independent variable is what the scientist changes on purpose. In this experiment, the scientist would change the amount of sunlight while keeping other factors the same.', 35, 2, 'understand', 2, '["What is the scientist testing?", "What is being changed on purpose?"]'),

  -- Cell Biology Questions
  ('q_sci_cell_001', 'science', 'sci_ls_1a', 'topic_sci_cell_theory', 'multiple_choice', 'Which is NOT part of the cell theory?', '["All living things are made of cells", "Cells come from other cells", "All cells have a nucleus", "The cell is the basic unit of life"]', 'All cells have a nucleus', 'Cell theory states: (1) all living things are made of cells, (2) cells are the basic unit of life, and (3) all cells come from existing cells. Not all cells have a nucleus - bacteria are cells without a nucleus.', 35, 2, 'remember', 2, '["Think about bacteria", "Do all cells have the same structures?"]'),

  ('q_sci_cell_002', 'science', 'sci_ls_1b', 'topic_sci_cell_organelles', 'multiple_choice', 'Which organelle is called the "powerhouse" of the cell?', '["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"]', 'Mitochondria', 'Mitochondria are called the "powerhouse" because they produce ATP, the energy currency of the cell, through cellular respiration.', 25, 1, 'remember', 1, '["Where does energy production happen?", "What produces ATP?"]'),

  ('q_sci_cell_003', 'science', 'sci_ls_1b', 'topic_sci_cell_organelles', 'multiple_choice', 'Which organelle is found in plant cells but NOT animal cells?', '["Mitochondria", "Cell wall and chloroplast", "Nucleus", "Ribosome"]', 'Cell wall and chloroplast', 'Plant cells have cell walls (for structure) and chloroplasts (for photosynthesis) that animal cells do not have. Mitochondria, nucleus, and ribosomes are in both.', 30, 2, 'understand', 2, '["What do plants do that animals don''t?", "Photosynthesis needs what structure?"]'),

  ('q_sci_photosynthesis_001', 'science', 'sci_ls_1f', 'topic_sci_photosynthesis', 'multiple_choice', 'What are the products of photosynthesis?', '["Carbon dioxide and water", "Glucose and oxygen", "Carbon dioxide and oxygen", "Glucose and water"]', 'Glucose and oxygen', 'Photosynthesis converts carbon dioxide and water into glucose (sugar) and oxygen using light energy. The equation is: CO₂ + H₂O + light → C₆H₁₂O₆ + O₂', 35, 2, 'remember', 2, '["What do plants make?", "What gas do plants release?"]'),

  ('q_sci_photosynthesis_002', 'science', 'sci_ls_1f', 'topic_sci_photosynthesis', 'multiple_choice', 'Where does photosynthesis occur in a plant cell?', '["Mitochondria", "Nucleus", "Chloroplast", "Cell wall"]', 'Chloroplast', 'Photosynthesis occurs in chloroplasts, which contain chlorophyll - the green pigment that absorbs light energy.', 25, 1, 'remember', 1, '["What organelle is green?", "What contains chlorophyll?"]'),

  -- Ecosystem Questions
  ('q_sci_ecosystem_001', 'science', 'sci_ls_2b', 'topic_sci_food_webs', 'multiple_choice', 'In a food chain, what role do decomposers play?', '["They produce food from sunlight", "They eat other animals", "They break down dead organisms", "They provide shelter"]', 'They break down dead organisms', 'Decomposers like bacteria and fungi break down dead plants and animals, returning nutrients to the soil where they can be used by plants.', 30, 2, 'understand', 2, '["What happens to dead organisms?", "How do nutrients return to the soil?"]'),

  ('q_sci_ecosystem_002', 'science', 'sci_ls_2b', 'topic_sci_food_webs', 'multiple_choice', 'Why is there less energy available at each level of a food chain?', '["Animals don''t eat much", "Energy is lost as heat at each level", "Plants produce less over time", "Decomposers take most energy"]', 'Energy is lost as heat at each level', 'At each level of a food chain, about 90% of energy is lost as heat during life processes. Only about 10% passes to the next level.', 45, 2, 'understand', 3, '["What happens to energy during metabolism?", "How efficient is energy transfer?"]'),

  -- Physical Science Questions
  ('q_sci_atom_001', 'science', 'sci_ps_1a', 'topic_sci_atomic_structure', 'multiple_choice', 'What determines the identity of an element?', '["Number of electrons", "Number of protons", "Number of neutrons", "Atomic mass"]', 'Number of protons', 'The number of protons (atomic number) determines what element an atom is. Changing the number of protons changes the element entirely.', 35, 2, 'understand', 2, '["What is the atomic number?", "What makes carbon different from oxygen?"]'),

  ('q_sci_atom_002', 'science', 'sci_ps_1a', 'topic_sci_elements_compounds', 'multiple_choice', 'What is the chemical formula for water?', '["H₂O", "CO₂", "NaCl", "O₂"]', 'H₂O', 'Water is made of 2 hydrogen atoms and 1 oxygen atom, written as H₂O. CO₂ is carbon dioxide, NaCl is salt, and O₂ is oxygen gas.', 20, 1, 'remember', 1, '["How many hydrogens? How many oxygens?"]'),

  ('q_sci_chemical_001', 'science', 'sci_ps_1b', 'topic_sci_chemical_reactions', 'multiple_choice', 'Which is evidence of a chemical change?', '["Ice melting", "Wood burning", "Sugar dissolving", "Paper tearing"]', 'Wood burning', 'Burning creates new substances (ash, smoke, gases) and cannot be reversed. Melting, dissolving, and tearing are physical changes that don''t create new substances.', 30, 2, 'apply', 2, '["Which creates a new substance?", "Which cannot be reversed?"]'),

  ('q_sci_forces_001', 'science', 'sci_ps_2b', 'topic_sci_forces_intro', 'multiple_choice', 'According to Newton''s First Law, an object at rest will:', '["Always start moving", "Stay at rest unless acted on by a force", "Speed up over time", "Slow down over time"]', 'Stay at rest unless acted on by a force', 'Newton''s First Law (Law of Inertia) states objects at rest stay at rest, and objects in motion stay in motion, unless acted on by an unbalanced force.', 30, 2, 'remember', 2, '["What is inertia?", "What changes an object''s motion?"]'),

  ('q_sci_energy_001', 'science', 'sci_ps_3a', 'topic_sci_energy_forms', 'multiple_choice', 'A ball at the top of a hill has what type of energy?', '["Kinetic energy", "Potential energy", "Thermal energy", "Chemical energy"]', 'Potential energy', 'An object at rest at a height has gravitational potential energy due to its position. This energy will convert to kinetic energy as it rolls down.', 25, 2, 'apply', 2, '["Is the ball moving?", "Does its position give it stored energy?"]'),

  -- Earth Science Questions
  ('q_sci_earth_001', 'science', 'sci_ess_1a', 'topic_sci_earth_sun_moon', 'multiple_choice', 'What causes the seasons on Earth?', '["Distance from the sun", "Earth''s tilted axis", "The moon''s gravity", "Changing speed of Earth"]', 'Earth''s tilted axis', 'Earth''s axis is tilted about 23.5°. This tilt causes different parts of Earth to receive more direct sunlight at different times of year, creating seasons.', 40, 2, 'understand', 2, '["Does Earth''s distance change much?", "How does tilt affect sunlight?"]'),

  ('q_sci_earth_002', 'science', 'sci_ess_2b', 'topic_sci_plate_tectonics', 'multiple_choice', 'What causes tectonic plates to move?', '["Wind patterns", "Convection currents in the mantle", "Magnetic attraction", "Ocean tides"]', 'Convection currents in the mantle', 'Heat from Earth''s core creates convection currents in the mantle. Hot rock rises, cools, and sinks, creating circular currents that push and pull the plates.', 45, 2, 'understand', 2, '["What is below the crust?", "How does heat move?"]'),

  ('q_sci_rock_001', 'science', 'sci_ess_2c', 'topic_sci_rock_cycle', 'multiple_choice', 'How are igneous rocks formed?', '["From layers of sediment", "From cooling magma or lava", "From heat and pressure on existing rock", "From plant remains"]', 'From cooling magma or lava', 'Igneous rocks form when molten rock (magma underground or lava above ground) cools and solidifies. Examples include granite and basalt.', 30, 2, 'remember', 2, '["What is magma?", "What happens when it cools?"]'),

  ('q_sci_water_001', 'science', 'sci_ess_2d', 'topic_sci_water_cycle', 'multiple_choice', 'What process moves water from leaves into the atmosphere?', '["Precipitation", "Condensation", "Transpiration", "Infiltration"]', 'Transpiration', 'Transpiration is the process where water evaporates from plant leaves through tiny openings called stomata. It''s a major way water enters the atmosphere.', 35, 2, 'remember', 2, '["How do plants release water?", "What happens through stomata?"]'),

  ('q_sci_climate_001', 'science', 'sci_ess_3e', 'topic_sci_climate_change', 'multiple_choice', 'What is the greenhouse effect?', '["Plants growing in greenhouses", "Heat being trapped by atmospheric gases", "Green algae absorbing heat", "Photosynthesis releasing heat"]', 'Heat being trapped by atmospheric gases', 'The greenhouse effect is when gases like CO₂ and methane trap heat in Earth''s atmosphere, similar to how a greenhouse stays warm. Too much causes global warming.', 40, 2, 'understand', 2, '["What do greenhouse gases do?", "How does Earth stay warm?"]');

-- ============================================================================
-- PREREQUISITES FOR SCIENCE TOPICS
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  ('prereq_sci_001', 'topic_sci_hypothesis', 'topic', 'topic_sci_scientific_questions', 'topic', 'required'),
  ('prereq_sci_002', 'topic_sci_experiments', 'topic', 'topic_sci_hypothesis', 'topic', 'required'),
  ('prereq_sci_003', 'topic_sci_data_analysis', 'topic', 'topic_sci_experiments', 'topic', 'required'),
  ('prereq_sci_004', 'topic_sci_evidence_reasoning', 'topic', 'topic_sci_data_analysis', 'topic', 'required'),
  ('prereq_sci_005', 'topic_sci_cell_organelles', 'topic', 'topic_sci_cell_types', 'topic', 'required'),
  ('prereq_sci_006', 'topic_sci_cell_processes', 'topic', 'topic_sci_cell_organelles', 'topic', 'required'),
  ('prereq_sci_007', 'topic_sci_photosynthesis', 'topic', 'topic_sci_cell_organelles', 'topic', 'required'),
  ('prereq_sci_008', 'topic_sci_cellular_respiration', 'topic', 'topic_sci_cell_organelles', 'topic', 'required'),
  ('prereq_sci_009', 'topic_sci_elements_compounds', 'topic', 'topic_sci_atomic_structure', 'topic', 'required'),
  ('prereq_sci_010', 'topic_sci_chemical_reactions', 'topic', 'topic_sci_elements_compounds', 'topic', 'required'),
  ('prereq_sci_011', 'topic_sci_plate_tectonics', 'topic', 'topic_sci_rock_cycle', 'topic', 'recommended'),
  ('prereq_sci_012', 'topic_sci_climate_change', 'topic', 'topic_sci_weather', 'topic', 'required');
