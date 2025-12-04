-- HYRO FORGE: Expanded Science Question Bank
-- Migration 028: 80+ Additional Science Questions for Robust Diagnostic Assessment
--
-- Focus: Scientific practices, Life Science, Physical Science, Earth Science
-- Philosophy: Test understanding of HOW science works, not just facts
-- Aligned with NGSS (Next Generation Science Standards)

INSERT INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

-- =============================================================================
-- SCIENTIFIC PRACTICES (SEP)
-- =============================================================================

('q_sci_sep_101', 'science', 'sep_1', 'topic_sci_questions', 'multiple_choice', 'Which is a testable scientific question?', '["Why is the sky beautiful?", "What is the best color?", "Does the amount of sunlight affect plant growth?", "Is summer better than winter?"]', 'Does the amount of sunlight affect plant growth?', 'Testable questions can be investigated with experiments. We can measure sunlight and plant growth. Beauty and best are subjective.', 35, 2, 'analyze', 2, '["Can you measure it?", "Can you run an experiment?"]'),

('q_sci_sep_102', 'science', 'sep_1', 'topic_sci_questions', 'multiple_choice', 'A good hypothesis should be:', '["Always correct", "Testable and based on prior knowledge", "A random guess", "As complex as possible"]', 'Testable and based on prior knowledge', 'Hypotheses are educated predictions based on what we already know, stated in a way that can be tested.', 35, 2, 'understand', 2, '["What makes a hypothesis good?", "It needs to be checkable"]'),

('q_sci_sep_103', 'science', 'sep_3', 'topic_sci_investigation', 'multiple_choice', 'In an experiment testing if fertilizer helps plants grow, what is the independent variable?', '["Plant height", "Amount of water", "Amount of fertilizer", "Type of pot"]', 'Amount of fertilizer', 'The independent variable is what the experimenter changes on purpose. Here, we change fertilizer to see its effect.', 40, 2, 'analyze', 2, '["What do you change on purpose?", "What are you testing?"]'),

('q_sci_sep_104', 'science', 'sep_3', 'topic_sci_investigation', 'multiple_choice', 'Why is having a control group important?', '["It makes the experiment longer", "It provides a baseline for comparison", "It uses up extra materials", "Its not important"]', 'It provides a baseline for comparison', 'Without a control, you cant know if changes in the experimental group are due to your variable or something else.', 40, 2, 'understand', 2, '["What do you compare results to?", "How do you know if the change mattered?"]'),

('q_sci_sep_105', 'science', 'sep_3', 'topic_sci_investigation', 'multiple_choice', 'What are controlled variables?', '["Variables that change", "Variables kept the same to ensure fair testing", "Variables you measure", "Variables you guess"]', 'Variables kept the same to ensure fair testing', 'Controlled variables are held constant so that only the independent variable affects the results.', 40, 2, 'understand', 2, '["Fair test = only one thing changes", "What stays the same?"]'),

('q_sci_sep_106', 'science', 'sep_4', 'topic_sci_data', 'multiple_choice', 'When is a line graph most appropriate?', '["Comparing categories", "Showing change over time", "Showing parts of a whole", "Listing facts"]', 'Showing change over time', 'Line graphs are best for continuous data and trends over time. Bar graphs compare categories.', 35, 2, 'apply', 2, '["Time on x-axis usually means...", "Lines show trends"]'),

('q_sci_sep_107', 'science', 'sep_4', 'topic_sci_data', 'multiple_choice', 'Your data shows most plants grew between 5-7 cm, but one grew 20 cm. The 20 cm is likely:', '["The most accurate measurement", "An outlier that should be investigated", "Proof the experiment failed", "Unimportant"]', 'An outlier that should be investigated', 'Outliers are data points far from the others. They should be checked for errors or unusual conditions, not ignored.', 45, 2, 'analyze', 3, '["Why so different?", "Could there be an error?"]'),

('q_sci_sep_108', 'science', 'sep_5', 'topic_sci_math', 'multiple_choice', 'You measure the same length 3 times and get 5.2, 5.3, and 5.1 cm. The mean (average) is:', '["5.0 cm", "5.2 cm", "5.3 cm", "5.6 cm"]', '5.2 cm', 'Mean = (5.2 + 5.3 + 5.1) / 3 = 15.6 / 3 = 5.2 cm. Averaging reduces random error.', 30, 2, 'apply', 2, '["Add them up", "Divide by how many"]'),

('q_sci_sep_109', 'science', 'sep_6', 'topic_sci_models', 'multiple_choice', 'Why do scientists use models?', '["Because theyre fun to make", "To simplify complex systems for understanding", "Because they dont know the real answer", "Models are always perfect"]', 'To simplify complex systems for understanding', 'Models represent complex systems in simpler ways. They help us understand, predict, and communicate, but are never perfect representations.', 40, 2, 'understand', 2, '["What can models help with?", "Do they represent reality perfectly?"]'),

('q_sci_sep_110', 'science', 'sep_6', 'topic_sci_models', 'multiple_choice', 'A limitation of all scientific models is that they:', '["Are always wrong", "Simplify reality and cant capture everything", "Are too expensive", "Take too long to make"]', 'Simplify reality and cant capture everything', 'All models are simplified. They highlight some features while ignoring others. This is a tradeoff, not a flaw.', 45, 2, 'analyze', 3, '["Can any model be perfect?", "What does simplifying mean?"]'),

('q_sci_sep_111', 'science', 'sep_7', 'topic_sci_argument', 'multiple_choice', 'In scientific argumentation, a claim must be supported by:', '["Personal opinion", "Evidence and logical reasoning", "The teachers answer", "Nothing"]', 'Evidence and logical reasoning', 'Scientific arguments require claims backed by evidence (data, observations) and reasoning that connects evidence to claim.', 35, 2, 'understand', 2, '["What backs up a claim?", "Opinion vs. evidence"]'),

('q_sci_sep_112', 'science', 'sep_7', 'topic_sci_argument', 'multiple_choice', 'If new evidence contradicts a scientific claim, scientists should:', '["Ignore the new evidence", "Revise the claim based on evidence", "Stop doing science", "Assume the evidence is wrong"]', 'Revise the claim based on evidence', 'Science is self-correcting. When evidence contradicts a claim, scientists revise their understanding.', 40, 2, 'understand', 2, '["Science changes with evidence", "What if youre wrong?"]'),

-- =============================================================================
-- LIFE SCIENCE
-- =============================================================================

-- Cell Biology
('q_sci_ls_101', 'science', 'ms_ls1_1', 'topic_ls_cells', 'multiple_choice', 'The cell theory states that:', '["Cells are made of atoms", "All living things are made of cells, cells are the basic unit of life, and cells come from existing cells", "Only animals have cells", "Cells were created once and never change"]', 'All living things are made of cells, cells are the basic unit of life, and cells come from existing cells', 'Cell theory is a fundamental principle in biology established through observations of many organisms.', 35, 2, 'remember', 2, '["Three main points", "Where do cells come from?"]'),

('q_sci_ls_102', 'science', 'ms_ls1_1', 'topic_ls_cells', 'multiple_choice', 'What is the function of the mitochondria?', '["Stores water", "Produces energy (ATP) for the cell", "Controls the cell", "Makes proteins"]', 'Produces energy (ATP) for the cell', 'Mitochondria are the powerhouses of the cell, converting nutrients into ATP energy through cellular respiration.', 35, 2, 'understand', 2, '["Where does cell energy come from?", "Powerhouse of the cell"]'),

('q_sci_ls_103', 'science', 'ms_ls1_1', 'topic_ls_cells', 'multiple_choice', 'Which structure is found in plant cells but NOT animal cells?', '["Nucleus", "Cell membrane", "Cell wall and chloroplasts", "Mitochondria"]', 'Cell wall and chloroplasts', 'Plant cells have cell walls (for structure) and chloroplasts (for photosynthesis). Animal cells lack both.', 35, 2, 'understand', 2, '["What do plants do that animals dont?", "Photosynthesis needs..."]'),

-- Body Systems
('q_sci_ls_104', 'science', 'ms_ls1_3', 'topic_ls_body_systems', 'multiple_choice', 'Which body system is responsible for transporting oxygen throughout the body?', '["Digestive system", "Circulatory system", "Nervous system", "Skeletal system"]', 'Circulatory system', 'The circulatory system (heart, blood, blood vessels) transports oxygen, nutrients, and wastes throughout the body.', 30, 2, 'understand', 2, '["What carries blood?", "Heart is part of..."]'),

('q_sci_ls_105', 'science', 'ms_ls1_3', 'topic_ls_body_systems', 'multiple_choice', 'How do the digestive and circulatory systems work together?', '["They dont interact", "Digestion breaks down food; circulation delivers nutrients to cells", "Circulation digests food", "Digestion pumps blood"]', 'Digestion breaks down food; circulation delivers nutrients to cells', 'Body systems interact. Digestion breaks food into nutrients that the blood then carries to all cells.', 40, 2, 'analyze', 3, '["What does each system do?", "How do they connect?"]'),

-- Genetics
('q_sci_ls_106', 'science', 'ms_ls3_1', 'topic_ls_genetics', 'multiple_choice', 'Where is genetic information stored in a cell?', '["Cell membrane", "DNA in the nucleus", "Mitochondria", "Cytoplasm"]', 'DNA in the nucleus', 'DNA (deoxyribonucleic acid) in the nucleus contains the genetic instructions for building and running the organism.', 30, 2, 'understand', 2, '["What does DNA do?", "Where is DNA located?"]'),

('q_sci_ls_107', 'science', 'ms_ls3_1', 'topic_ls_genetics', 'multiple_choice', 'If a parent has genes for both brown eyes (B) and blue eyes (b), and brown is dominant, the parent has:', '["Blue eyes", "Brown eyes", "Green eyes", "No eyes"]', 'Brown eyes', 'Dominant traits show up when at least one dominant allele is present. Bb = brown eyes because B is dominant.', 40, 2, 'apply', 2, '["Dominant shows over recessive", "B = dominant"]'),

('q_sci_ls_108', 'science', 'ms_ls3_2', 'topic_ls_genetics', 'multiple_choice', 'Why might identical twins have different heights as adults?', '["Their genes are different", "Environment (nutrition, health) also affects traits", "One is adopted", "Genes dont affect height"]', 'Environment (nutrition, health) also affects traits', 'Both genes AND environment affect traits. Identical twins have same genes but different experiences.', 45, 2, 'analyze', 3, '["Same genes, different heights - why?", "Nature AND nurture"]'),

-- Ecosystems
('q_sci_ls_109', 'science', 'ms_ls2_1', 'topic_ls_ecosystems', 'multiple_choice', 'In a food chain, what happens to energy as it moves from producers to consumers?', '["Energy increases", "About 10% transfers, 90% is lost as heat", "Energy stays the same", "Energy disappears"]', 'About 10% transfers, 90% is lost as heat', 'The 10% rule: only about 10% of energy transfers between trophic levels. The rest is used for life processes or lost as heat.', 45, 2, 'understand', 3, '["Why are there fewer top predators?", "Energy loss at each level"]'),

('q_sci_ls_110', 'science', 'ms_ls2_1', 'topic_ls_ecosystems', 'multiple_choice', 'Organisms that break down dead matter and recycle nutrients are called:', '["Producers", "Consumers", "Decomposers", "Predators"]', 'Decomposers', 'Decomposers (fungi, bacteria) break down dead organisms, returning nutrients to the soil for producers to use.', 30, 2, 'understand', 2, '["What happens to dead things?", "Who recycles nutrients?"]'),

('q_sci_ls_111', 'science', 'ms_ls2_4', 'topic_ls_ecosystems', 'multiple_choice', 'What would likely happen if a top predator were removed from an ecosystem?', '["Nothing would change", "Its prey population would increase, possibly harming vegetation", "All organisms would die", "The ecosystem would improve"]', 'Its prey population would increase, possibly harming vegetation', 'Removing predators can cause prey populations to explode, which can then overeat vegetation, creating cascade effects.', 50, 3, 'analyze', 3, '["What controls prey populations?", "Think chain reaction"]'),

-- =============================================================================
-- PHYSICAL SCIENCE
-- =============================================================================

-- Matter
('q_sci_ps_101', 'science', 'ms_ps1_1', 'topic_ps_matter', 'multiple_choice', 'What are the three common states of matter?', '["Hot, cold, warm", "Solid, liquid, gas", "Heavy, light, medium", "Water, air, earth"]', 'Solid, liquid, gas', 'Matter exists as solid (definite shape/volume), liquid (definite volume, takes container shape), or gas (takes containers shape and volume).', 25, 1, 'remember', 1, '["Think of water in different forms", "Ice, water, steam"]'),

('q_sci_ps_102', 'science', 'ms_ps1_1', 'topic_ps_matter', 'multiple_choice', 'How do particles move differently in solids vs. gases?', '["Same movement in both", "Solid particles vibrate in place; gas particles move freely and fast", "Gas particles dont move", "Solid particles move faster"]', 'Solid particles vibrate in place; gas particles move freely and fast', 'Particle motion explains state properties. Solids vibrate in fixed positions; gases move freely with high energy.', 40, 2, 'understand', 2, '["Why do solids hold shape?", "Why do gases expand?"]'),

('q_sci_ps_103', 'science', 'ms_ps1_2', 'topic_ps_matter', 'multiple_choice', 'Which is a chemical property of a substance?', '["Color", "Density", "Flammability", "Melting point"]', 'Flammability', 'Chemical properties describe how a substance reacts with other substances. Flammability is about reaction with oxygen. Color, density, and melting point are physical properties.', 40, 2, 'understand', 2, '["Does it involve a chemical change?", "Burning = chemical reaction"]'),

('q_sci_ps_104', 'science', 'ms_ps1_4', 'topic_ps_reactions', 'multiple_choice', 'What are the signs of a chemical reaction?', '["Nothing visible happens", "Color change, gas production, temperature change, precipitate formation", "Only explosions", "Size change only"]', 'Color change, gas production, temperature change, precipitate formation', 'Chemical reactions often show visible signs: new colors, bubbles (gas), heat/cold, or solid forming from liquids.', 35, 2, 'remember', 2, '["What can you observe?", "New substances form"]'),

('q_sci_ps_105', 'science', 'ms_ps1_5', 'topic_ps_reactions', 'multiple_choice', 'In a chemical reaction, atoms are:', '["Created", "Destroyed", "Rearranged into new combinations", "Split in half"]', 'Rearranged into new combinations', 'Law of conservation of mass: atoms are neither created nor destroyed, just rearranged into new molecules.', 40, 2, 'understand', 2, '["Where do product atoms come from?", "Conservation of mass"]'),

-- Forces and Motion
('q_sci_ps_106', 'science', 'ms_ps2_1', 'topic_ps_forces', 'multiple_choice', 'If two forces push in opposite directions with equal strength, the result is:', '["Motion in both directions", "No motion (balanced forces)", "Explosion", "Faster motion"]', 'No motion (balanced forces)', 'When forces are equal and opposite, they cancel out. The net force is zero, so no acceleration occurs.', 35, 2, 'apply', 2, '["What happens when forces cancel?", "Equal and opposite"]'),

('q_sci_ps_107', 'science', 'ms_ps2_2', 'topic_ps_forces', 'multiple_choice', 'According to Newtons second law, if you double the force on an object, its acceleration will:', '["Stay the same", "Double", "Halve", "Triple"]', 'Double', 'F = ma means acceleration is proportional to force. Double force = double acceleration (assuming mass stays same).', 40, 2, 'apply', 2, '["F = ma", "What happens to a if F doubles?"]'),

('q_sci_ps_108', 'science', 'ms_ps2_2', 'topic_ps_forces', 'multiple_choice', 'Why does a heavy truck need more force to accelerate than a car?', '["Trucks are slower", "Greater mass requires greater force for the same acceleration", "Trucks have worse engines", "Gravity is stronger on trucks"]', 'Greater mass requires greater force for the same acceleration', 'F = ma: more mass means more force needed for the same acceleration. This is inertia.', 40, 2, 'understand', 2, '["Think about F = ma", "Mass resists acceleration"]'),

-- Energy
('q_sci_ps_109', 'science', 'ms_ps3_1', 'topic_ps_energy', 'multiple_choice', 'A ball at the top of a hill has what type of energy?', '["Kinetic energy", "Potential energy", "Thermal energy", "No energy"]', 'Potential energy', 'Objects at height have gravitational potential energy. It converts to kinetic energy as the ball rolls down.', 30, 2, 'understand', 2, '["Stored energy from position", "What happens when it rolls?"]'),

('q_sci_ps_110', 'science', 'ms_ps3_2', 'topic_ps_energy', 'multiple_choice', 'When you rub your hands together and they get warm, what energy transformation occurs?', '["Chemical to thermal", "Kinetic to thermal", "Thermal to kinetic", "No transformation"]', 'Kinetic to thermal', 'Friction converts kinetic (motion) energy into thermal (heat) energy. This is why brakes get hot.', 35, 2, 'apply', 2, '["Motion creates heat", "Where does the heat come from?"]'),

('q_sci_ps_111', 'science', 'ms_ps3_3', 'topic_ps_energy', 'multiple_choice', 'Energy cannot be created or destroyed, only transformed. This is:', '["Newtons law", "The law of conservation of energy", "Theory of relativity", "A hypothesis"]', 'The law of conservation of energy', 'Conservation of energy is a fundamental law: total energy in a closed system stays constant, just changes form.', 35, 2, 'remember', 2, '["Energy changes form but...", "Total energy stays same"]'),

-- Waves
('q_sci_ps_112', 'science', 'ms_ps4_1', 'topic_ps_waves', 'multiple_choice', 'What do waves transfer?', '["Matter", "Energy", "Both matter and energy", "Nothing"]', 'Energy', 'Waves transfer energy without transferring matter. Think of a wave in water - the water moves up and down but doesnt travel with the wave.', 40, 2, 'understand', 2, '["Does the water move forward with the wave?", "What gets carried?"]'),

('q_sci_ps_113', 'science', 'ms_ps4_2', 'topic_ps_waves', 'multiple_choice', 'Sound travels fastest through:', '["Air", "Water", "Steel", "Vacuum"]', 'Steel', 'Sound travels fastest through solids (particles are closer). It cannot travel through vacuum (no particles).', 40, 2, 'understand', 2, '["Sound needs particles", "Where are particles closest?"]'),

-- =============================================================================
-- EARTH AND SPACE SCIENCE
-- =============================================================================

('q_sci_es_101', 'science', 'ms_ess1_1', 'topic_es_solar_system', 'multiple_choice', 'Why do we have seasons on Earth?', '["Earths distance from the Sun", "Earths tilted axis causes different angles of sunlight", "The Sun gets hotter and cooler", "Moon phases"]', 'Earths tilted axis causes different angles of sunlight', 'Earths 23.5° tilt means different hemispheres receive more direct sunlight at different times of year, causing seasons.', 40, 2, 'understand', 2, '["Is Earth closer in summer?", "Tilt affects sunlight angle"]'),

('q_sci_es_102', 'science', 'ms_ess1_2', 'topic_es_solar_system', 'multiple_choice', 'How long does it take Earth to complete one orbit around the Sun?', '["24 hours", "1 month", "1 year", "100 years"]', '1 year', 'One complete orbit around the Sun = one year (about 365.25 days). One rotation on axis = one day.', 25, 1, 'remember', 1, '["Orbit vs. rotation", "What defines a year?"]'),

('q_sci_es_103', 'science', 'ms_ess2_1', 'topic_es_plate_tectonics', 'multiple_choice', 'What causes earthquakes?', '["Wind", "Movement of tectonic plates", "Volcanic eruptions only", "Ocean waves"]', 'Movement of tectonic plates', 'Earthquakes occur when tectonic plates move, stress builds up, and is suddenly released along fault lines.', 35, 2, 'understand', 2, '["What moves beneath Earths surface?", "Plates sliding past each other"]'),

('q_sci_es_104', 'science', 'ms_ess2_2', 'topic_es_plate_tectonics', 'multiple_choice', 'At a divergent plate boundary, plates:', '["Collide", "Slide past each other", "Move apart", "Stay still"]', 'Move apart', 'Divergent boundaries are where plates move apart, creating new crust. Example: Mid-Atlantic Ridge.', 35, 2, 'understand', 2, '["Diverge = move apart", "What happens between spreading plates?"]'),

('q_sci_es_105', 'science', 'ms_ess2_3', 'topic_es_rock_cycle', 'multiple_choice', 'Sedimentary rocks form when:', '["Magma cools", "Sediments are compacted and cemented together", "Rocks are heated and pressurized", "Rocks melt"]', 'Sediments are compacted and cemented together', 'Sedimentary rocks form from layers of sediment (sand, mud, shells) pressed together over time.', 35, 2, 'understand', 2, '["Think of layers", "Pressed and glued"]'),

('q_sci_es_106', 'science', 'ms_ess2_4', 'topic_es_water_cycle', 'multiple_choice', 'Water rises into the atmosphere through:', '["Condensation", "Evaporation and transpiration", "Precipitation", "Collection"]', 'Evaporation and transpiration', 'Evaporation (from water surfaces) and transpiration (from plants) move water into the atmosphere as vapor.', 30, 2, 'understand', 2, '["How does water get into the air?", "Two processes"]'),

('q_sci_es_107', 'science', 'ms_ess2_5', 'topic_es_weather', 'multiple_choice', 'What causes wind?', '["Trees moving", "Differences in air pressure caused by uneven heating", "The Moon", "Ocean currents"]', 'Differences in air pressure caused by uneven heating', 'The Sun heats Earth unevenly. Warm air rises (low pressure), cool air sinks (high pressure). Air moves from high to low pressure = wind.', 40, 2, 'understand', 2, '["What causes pressure differences?", "Air moves from high to low"]'),

('q_sci_es_108', 'science', 'ms_ess3_1', 'topic_es_resources', 'multiple_choice', 'Which is a renewable resource?', '["Coal", "Natural gas", "Solar energy", "Petroleum"]', 'Solar energy', 'Renewable resources regenerate naturally on human timescales. Solar energy from the Sun is essentially unlimited. Fossil fuels take millions of years to form.', 30, 2, 'understand', 2, '["Can it be replaced quickly?", "Will the Sun run out soon?"]'),

('q_sci_es_109', 'science', 'ms_ess3_3', 'topic_es_resources', 'multiple_choice', 'What is the main cause of recent climate change?', '["Volcanic eruptions", "The Suns cycles", "Human release of greenhouse gases", "Natural variation only"]', 'Human release of greenhouse gases', 'Human activities (burning fossil fuels, deforestation) release CO2 and other greenhouse gases that trap heat.', 40, 2, 'understand', 2, '["What has changed recently?", "Greenhouse effect"]'),

('q_sci_es_110', 'science', 'ms_ess3_4', 'topic_es_natural_hazards', 'multiple_choice', 'How can communities reduce the impact of natural hazards?', '["Ignore them", "Build structures to code, have warning systems, create evacuation plans", "Move everyone to one location", "Nothing can be done"]', 'Build structures to code, have warning systems, create evacuation plans', 'While we cant prevent natural hazards, engineering solutions and preparedness can significantly reduce their impact.', 35, 2, 'apply', 2, '["What can humans control?", "Prevention vs. preparation"]'),

-- =============================================================================
-- CROSS-CUTTING CONCEPTS AND ADVANCED QUESTIONS
-- =============================================================================

('q_sci_cc_101', 'science', 'sep_6', 'topic_sci_models', 'multiple_choice', 'A globe is a model of Earth. What is a limitation of this model?', '["It cant show colors", "It cant show scale, elevation details, or interior structure well", "It has no limitations", "Its too accurate"]', 'It cant show scale, elevation details, or interior structure well', 'Globes simplify: they cant show true elevations, dont represent the interior, and are not to perfect scale. All models have limitations.', 45, 3, 'evaluate', 3, '["What does a globe leave out?", "Can you see inside?"]'),

('q_sci_cc_102', 'science', 'sep_4', 'topic_sci_data', 'multiple_choice', 'An experiment is repeated 5 times. Results: 10, 11, 10, 45, 11. The 45 is most likely:', '["The correct answer", "An error or anomaly that should be investigated", "Proof the hypothesis is wrong", "The most important data point"]', 'An error or anomaly that should be investigated', 'Outliers should be examined. Was there an error? Different conditions? Dont discard data, but investigate anomalies.', 50, 3, 'evaluate', 4, '["One result is very different", "Error or real?"]'),

('q_sci_cc_103', 'science', 'sep_7', 'topic_sci_argument', 'multiple_choice', 'Two scientists disagree about a conclusion. The BEST way to resolve this is:', '["Let the senior scientist win", "Gather more evidence and see which conclusion it supports", "Vote on it", "Ignore both conclusions"]', 'Gather more evidence and see which conclusion it supports', 'Science resolves disagreements through evidence, not authority or popularity. More data helps clarify truth.', 45, 3, 'analyze', 3, '["How does science settle disputes?", "Evidence wins"]'),

('q_sci_cc_104', 'science', 'sep_8', 'topic_sci_knowledge', 'multiple_choice', 'Scientific theories are:', '["Just guesses", "Proven facts that never change", "Well-supported explanations based on extensive evidence that can be refined", "The same as everyday theories"]', 'Well-supported explanations based on extensive evidence that can be refined', 'Scientific theories are highly supported by evidence but remain open to revision as new evidence emerges. They are not guesses.', 50, 3, 'understand', 3, '["Theory in science vs. everyday use", "How are theories developed?"]'),

('q_sci_cc_105', 'science', 'ms_ps3_4', 'topic_ps_energy', 'multiple_choice', 'In a closed system, if kinetic energy decreases, what happens to total energy?', '["It decreases too", "It stays the same (energy was converted to another form)", "It increases", "The system breaks"]', 'It stays the same (energy was converted to another form)', 'Conservation of energy: total energy is constant. If kinetic energy decreases, it converted to another form (thermal, potential, etc.).', 50, 3, 'analyze', 3, '["Energy is conserved", "Where did the energy go?"]');
