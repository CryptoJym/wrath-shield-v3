-- HYRO FORGE: Financial Literacy Curriculum
-- Migration 030: Comprehensive Financial Literacy (Utah Graduation Requirement - 0.5 credits)
-- Domain: Social Studies (Economics/Finance strand)
-- Goal: Deep understanding of economic reality, not hoop-jumping

-- ============================================================================
-- FINANCIAL LITERACY STANDARDS (TIER 2 PRIORITY + Utah Requirement)
-- ============================================================================

-- STRAND 1: ECONOMIC FOUNDATIONS (FIN.ECO)
-- Understanding how the economic world actually works
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_eco_scarcity', 'social_studies', 'utah_core', 'FIN.ECO.1', 'Scarcity and Opportunity Cost', 'Understand that scarcity requires choices and every choice has an opportunity cost', NULL, 'middle', 'Economic Foundations', 'Resource Allocation', 1, 1),
  ('fin_eco_supply_demand', 'social_studies', 'utah_core', 'FIN.ECO.2', 'Supply and Demand', 'Understand how supply, demand, and prices coordinate economic activity', NULL, 'middle', 'Economic Foundations', 'Market Mechanisms', 2, 1),
  ('fin_eco_marginal', 'social_studies', 'utah_core', 'FIN.ECO.3', 'Marginal Thinking', 'Make decisions at the margin by comparing additional benefits to additional costs', NULL, 'middle', 'Economic Foundations', 'Decision Making', 3, 1),
  ('fin_eco_incentives', 'social_studies', 'utah_core', 'FIN.ECO.4', 'Incentives and Behavior', 'Understand how incentives shape behavior and predict responses to incentive changes', NULL, 'middle', 'Economic Foundations', 'Behavioral Economics', 4, 1),
  ('fin_eco_markets', 'social_studies', 'utah_core', 'FIN.ECO.5', 'Markets and Price Signals', 'Understand how markets use prices to communicate information and coordinate decisions', NULL, 'middle', 'Economic Foundations', 'Market Mechanisms', 5, 1),
  ('fin_eco_trade', 'social_studies', 'utah_core', 'FIN.ECO.6', 'Comparative Advantage and Trade', 'Understand gains from trade and specialization based on comparative advantage', NULL, 'middle', 'Economic Foundations', 'Trade', 6, 1),
  ('fin_eco_externalities', 'social_studies', 'utah_core', 'FIN.ECO.7', 'Externalities', 'Recognize when costs or benefits spill over to third parties', NULL, 'middle', 'Economic Foundations', 'Market Failures', 7, 1);

-- STRAND 2: PERSONAL FINANCE (FIN.PER)
-- Practical money management skills
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_per_income', 'social_studies', 'utah_core', 'FIN.PER.1', 'Income and Expenses', 'Understand sources of income and types of expenses', NULL, 'middle', 'Personal Finance', 'Money Management', 10, 1),
  ('fin_per_budgeting', 'social_studies', 'utah_core', 'FIN.PER.2', 'Budgeting Methods', 'Create and maintain a budget using various methods', NULL, 'middle', 'Personal Finance', 'Money Management', 11, 1),
  ('fin_per_saving', 'social_studies', 'utah_core', 'FIN.PER.3', 'Saving Strategies', 'Implement effective saving strategies and understand the time value of money', NULL, 'middle', 'Personal Finance', 'Wealth Building', 12, 1),
  ('fin_per_emergency', 'social_studies', 'utah_core', 'FIN.PER.4', 'Emergency Funds', 'Build and maintain an emergency fund for financial stability', NULL, 'middle', 'Personal Finance', 'Risk Management', 13, 1),
  ('fin_per_networth', 'social_studies', 'utah_core', 'FIN.PER.5', 'Net Worth Calculation', 'Calculate and track net worth (assets minus liabilities)', NULL, 'middle', 'Personal Finance', 'Wealth Building', 14, 1),
  ('fin_per_goals', 'social_studies', 'utah_core', 'FIN.PER.6', 'Financial Goal Setting', 'Set SMART financial goals and create action plans', NULL, 'middle', 'Personal Finance', 'Planning', 15, 1);

-- STRAND 3: BANKING & CREDIT (FIN.BNK)
-- How banking and credit actually work
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_bnk_how_banks_work', 'social_studies', 'utah_core', 'FIN.BNK.1', 'How Banks Work', 'Understand how banks function, make money, and serve customers', NULL, 'middle', 'Banking & Credit', 'Banking Basics', 20, 1),
  ('fin_bnk_interest', 'social_studies', 'utah_core', 'FIN.BNK.2', 'Simple and Compound Interest', 'Calculate simple and compound interest and understand their real-world impact', NULL, 'middle', 'Banking & Credit', 'Interest', 21, 1),
  ('fin_bnk_credit_scores', 'social_studies', 'utah_core', 'FIN.BNK.3', 'Credit Scores', 'Understand how credit scores are calculated and their importance', NULL, 'middle', 'Banking & Credit', 'Credit', 22, 1),
  ('fin_bnk_cards', 'social_studies', 'utah_core', 'FIN.BNK.4', 'Credit Cards vs Debit Cards', 'Compare credit and debit cards and use them responsibly', NULL, 'middle', 'Banking & Credit', 'Payment Methods', 23, 1),
  ('fin_bnk_loans', 'social_studies', 'utah_core', 'FIN.BNK.5', 'Loans and Debt', 'Understand different types of loans and responsible debt management', NULL, 'middle', 'Banking & Credit', 'Debt', 24, 1),
  ('fin_bnk_time_value', 'social_studies', 'utah_core', 'FIN.BNK.6', 'Time Value of Money', 'Understand that a dollar today is worth more than a dollar tomorrow', NULL, 'middle', 'Banking & Credit', 'Financial Concepts', 25, 1);

-- STRAND 4: INVESTING FUNDAMENTALS (FIN.INV)
-- Long-term wealth building through investing
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_inv_risk_reward', 'social_studies', 'utah_core', 'FIN.INV.1', 'Risk vs Reward', 'Understand the relationship between investment risk and potential return', NULL, 'middle', 'Investing', 'Investment Principles', 30, 1),
  ('fin_inv_diversification', 'social_studies', 'utah_core', 'FIN.INV.2', 'Diversification', 'Reduce risk through diversification across asset classes', NULL, 'middle', 'Investing', 'Risk Management', 31, 1),
  ('fin_inv_stocks_bonds', 'social_studies', 'utah_core', 'FIN.INV.3', 'Stocks and Bonds Basics', 'Understand stocks (ownership) and bonds (lending) as investment vehicles', NULL, 'middle', 'Investing', 'Asset Classes', 32, 1),
  ('fin_inv_index_funds', 'social_studies', 'utah_core', 'FIN.INV.4', 'Index Funds', 'Understand index funds as low-cost diversified investments', NULL, 'middle', 'Investing', 'Investment Vehicles', 33, 1),
  ('fin_inv_compound', 'social_studies', 'utah_core', 'FIN.INV.5', 'Compound Growth', 'Harness the power of compound growth over time', NULL, 'middle', 'Investing', 'Wealth Building', 34, 1),
  ('fin_inv_dca', 'social_studies', 'utah_core', 'FIN.INV.6', 'Dollar Cost Averaging', 'Use consistent investing to reduce timing risk', NULL, 'middle', 'Investing', 'Investment Strategies', 35, 1),
  ('fin_inv_long_term', 'social_studies', 'utah_core', 'FIN.INV.7', 'Long-Term Thinking', 'Adopt a long-term perspective for investing success', NULL, 'middle', 'Investing', 'Investment Philosophy', 36, 1);

-- STRAND 5: TAXES & GOVERNMENT (FIN.TAX)
-- Understanding the tax system and public finance
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_tax_how_work', 'social_studies', 'utah_core', 'FIN.TAX.1', 'How Taxes Work', 'Understand the purpose and mechanics of taxation', NULL, 'middle', 'Taxes & Government', 'Tax Basics', 40, 1),
  ('fin_tax_brackets', 'social_studies', 'utah_core', 'FIN.TAX.2', 'Tax Brackets', 'Understand progressive tax brackets and marginal vs effective tax rates', NULL, 'middle', 'Taxes & Government', 'Income Tax', 41, 1),
  ('fin_tax_types', 'social_studies', 'utah_core', 'FIN.TAX.3', 'Types of Taxes', 'Identify different types of taxes (income, sales, property, payroll)', NULL, 'middle', 'Taxes & Government', 'Tax System', 42, 1),
  ('fin_tax_services', 'social_studies', 'utah_core', 'FIN.TAX.4', 'Government Services', 'Understand what taxes pay for and evaluate trade-offs', NULL, 'middle', 'Taxes & Government', 'Public Finance', 43, 1),
  ('fin_tax_public_goods', 'social_studies', 'utah_core', 'FIN.TAX.5', 'Public Goods', 'Understand public goods and why markets may not provide them', NULL, 'middle', 'Taxes & Government', 'Public Economics', 44, 1);

-- STRAND 6: ENTREPRENEURSHIP & CAREERS (FIN.ENT)
-- Creating value and earning income
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_ent_income_sources', 'social_studies', 'utah_core', 'FIN.ENT.1', 'Income Sources', 'Understand different ways to earn income (employment, self-employment, investments)', NULL, 'middle', 'Entrepreneurship & Careers', 'Income', 50, 1),
  ('fin_ent_value', 'social_studies', 'utah_core', 'FIN.ENT.2', 'Creating Value', 'Understand that income comes from creating value for others', NULL, 'middle', 'Entrepreneurship & Careers', 'Value Creation', 51, 1),
  ('fin_ent_business', 'social_studies', 'utah_core', 'FIN.ENT.3', 'Business Basics', 'Understand basic business concepts (revenue, costs, profit)', NULL, 'middle', 'Entrepreneurship & Careers', 'Business', 52, 1),
  ('fin_ent_human_capital', 'social_studies', 'utah_core', 'FIN.ENT.4', 'Human Capital', 'Invest in skills and knowledge to increase earning potential', NULL, 'middle', 'Entrepreneurship & Careers', 'Career Development', 53, 1),
  ('fin_ent_career_planning', 'social_studies', 'utah_core', 'FIN.ENT.5', 'Career Planning', 'Plan career paths based on interests, skills, and market demand', NULL, 'middle', 'Entrepreneurship & Careers', 'Career Development', 54, 1),
  ('fin_ent_negotiation', 'social_studies', 'utah_core', 'FIN.ENT.6', 'Negotiation', 'Negotiate salary, benefits, and business deals effectively', NULL, 'middle', 'Entrepreneurship & Careers', 'Professional Skills', 55, 1);

-- STRAND 7: CONSUMER PROTECTION (FIN.CON)
-- Avoiding scams and making informed decisions
INSERT OR IGNORE INTO hyro_learning_standards (id, domain, standard_set, standard_code, title, description, grade_level, grade_band, strand, cluster, sequence_order, is_assessed) VALUES
  ('fin_con_scams', 'social_studies', 'utah_core', 'FIN.CON.1', 'Avoiding Scams', 'Identify and avoid financial scams and fraud', NULL, 'middle', 'Consumer Protection', 'Fraud Prevention', 60, 1),
  ('fin_con_contracts', 'social_studies', 'utah_core', 'FIN.CON.2', 'Understanding Contracts', 'Read and understand contracts before signing', NULL, 'middle', 'Consumer Protection', 'Legal Literacy', 61, 1),
  ('fin_con_insurance', 'social_studies', 'utah_core', 'FIN.CON.3', 'Insurance Basics', 'Understand how insurance transfers risk and evaluate coverage needs', NULL, 'middle', 'Consumer Protection', 'Risk Management', 62, 1),
  ('fin_con_advertising', 'social_studies', 'utah_core', 'FIN.CON.4', 'Advertising Awareness', 'Critically evaluate advertising and marketing claims', NULL, 'middle', 'Consumer Protection', 'Media Literacy', 63, 1),
  ('fin_con_rights', 'social_studies', 'utah_core', 'FIN.CON.5', 'Consumer Rights', 'Know your rights as a consumer and how to seek recourse', NULL, 'middle', 'Consumer Protection', 'Consumer Rights', 64, 1);

-- ============================================================================
-- CURRICULUM TOPICS - Breaking standards into learnable chunks
-- ============================================================================

-- ECONOMIC FOUNDATIONS TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Scarcity and Opportunity Cost
  ('topic_fin_scarcity', 'social_studies', 'fin_eco_scarcity', 'Understanding Scarcity', 'Why we cannot have everything we want', '["Define scarcity as unlimited wants vs limited resources", "Identify scarce resources in daily life", "Explain why scarcity requires choices"]', 1, 20),
  ('topic_fin_opp_cost', 'social_studies', 'fin_eco_scarcity', 'Opportunity Cost', 'The value of the next best alternative', '["Define opportunity cost", "Calculate opportunity cost in decisions", "Apply opportunity cost to real-world choices"]', 2, 25),

  -- Supply and Demand
  ('topic_fin_demand', 'social_studies', 'fin_eco_supply_demand', 'Law of Demand', 'How quantity demanded responds to price changes', '["Explain law of demand", "Graph a demand curve", "Identify factors that shift demand"]', 2, 30),
  ('topic_fin_supply', 'social_studies', 'fin_eco_supply_demand', 'Law of Supply', 'How quantity supplied responds to price changes', '["Explain law of supply", "Graph a supply curve", "Identify factors that shift supply"]', 2, 30),
  ('topic_fin_equilibrium', 'social_studies', 'fin_eco_supply_demand', 'Market Equilibrium', 'How markets find equilibrium price and quantity', '["Define market equilibrium", "Explain how prices adjust to equilibrium", "Predict effects of shifts in supply/demand"]', 3, 35),

  -- Marginal Thinking
  ('topic_fin_marginal_benefit', 'social_studies', 'fin_eco_marginal', 'Marginal Benefit', 'Additional benefit from one more unit', '["Define marginal benefit", "Calculate marginal benefit", "Explain diminishing marginal benefit"]', 2, 25),
  ('topic_fin_marginal_cost', 'social_studies', 'fin_eco_marginal', 'Marginal Cost', 'Additional cost of one more unit', '["Define marginal cost", "Calculate marginal cost", "Explain increasing marginal cost"]', 2, 25),
  ('topic_fin_marginal_decisions', 'social_studies', 'fin_eco_marginal', 'Making Decisions at the Margin', 'Comparing marginal benefit to marginal cost', '["Compare MB to MC", "Make optimal decisions", "Apply marginal analysis to real scenarios"]', 3, 30),

  -- Incentives
  ('topic_fin_incentives_basics', 'social_studies', 'fin_eco_incentives', 'How Incentives Work', 'Understanding incentives and behavior', '["Define incentives", "Distinguish positive vs negative incentives", "Explain how incentives change behavior"]', 1, 20),
  ('topic_fin_incentives_predict', 'social_studies', 'fin_eco_incentives', 'Predicting Responses to Incentives', 'Anticipating behavioral changes', '["Predict responses to incentive changes", "Identify unintended consequences", "Design effective incentives"]', 3, 30),

  -- Markets and Prices
  ('topic_fin_price_signals', 'social_studies', 'fin_eco_markets', 'Price Signals', 'How prices communicate information', '["Explain how prices signal scarcity", "Describe how prices coordinate decisions", "Analyze price changes"]', 2, 25),
  ('topic_fin_market_coordination', 'social_studies', 'fin_eco_markets', 'Market Coordination', 'How markets coordinate without central planning', '["Explain spontaneous order", "Describe role of profit/loss", "Evaluate market efficiency"]', 3, 30),

  -- Trade
  ('topic_fin_absolute_advantage', 'social_studies', 'fin_eco_trade', 'Absolute Advantage', 'Producing more efficiently', '["Define absolute advantage", "Calculate absolute advantage", "Distinguish from comparative advantage"]', 2, 25),
  ('topic_fin_comparative_advantage', 'social_studies', 'fin_eco_trade', 'Comparative Advantage', 'Producing at lower opportunity cost', '["Define comparative advantage", "Calculate opportunity cost for trade", "Explain gains from specialization"]', 3, 35),

  -- Externalities
  ('topic_fin_externalities', 'social_studies', 'fin_eco_externalities', 'Positive and Negative Externalities', 'Spillover effects on third parties', '["Define externalities", "Identify positive and negative externalities", "Explain why externalities cause market failure"]', 2, 25);

-- PERSONAL FINANCE TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Income and Expenses
  ('topic_fin_income_types', 'social_studies', 'fin_per_income', 'Types of Income', 'Earned income, passive income, portfolio income', '["Distinguish types of income", "Identify income sources", "Understand gross vs net income"]', 1, 20),
  ('topic_fin_expenses', 'social_studies', 'fin_per_income', 'Fixed vs Variable Expenses', 'Understanding different expense categories', '["Define fixed and variable expenses", "Categorize expenses", "Identify needs vs wants"]', 1, 20),

  -- Budgeting
  ('topic_fin_budget_basics', 'social_studies', 'fin_per_budgeting', 'Creating a Budget', 'Track income and expenses', '["List all income sources", "Track all expenses", "Create a monthly budget"]', 2, 30),
  ('topic_fin_budget_methods', 'social_studies', 'fin_per_budgeting', 'Budgeting Methods', '50/30/20, zero-based, envelope system', '["Explain 50/30/20 rule", "Describe zero-based budgeting", "Compare budgeting methods"]', 2, 25),
  ('topic_fin_budget_adjust', 'social_studies', 'fin_per_budgeting', 'Adjusting Budgets', 'Respond to income/expense changes', '["Monitor budget performance", "Adjust spending categories", "Handle unexpected expenses"]', 3, 25),

  -- Saving
  ('topic_fin_saving_why', 'social_studies', 'fin_per_saving', 'Why Save', 'Reasons and benefits of saving', '["Explain benefits of saving", "Set saving goals", "Calculate savings rate"]', 1, 20),
  ('topic_fin_pay_yourself_first', 'social_studies', 'fin_per_saving', 'Pay Yourself First', 'Automate saving before spending', '["Explain pay yourself first", "Set up automatic transfers", "Determine appropriate saving rate"]', 2, 20),
  ('topic_fin_compound_saving', 'social_studies', 'fin_per_saving', 'Compound Interest on Savings', 'How savings grow exponentially', '["Calculate compound interest", "Compare to simple interest", "Understand time value"]', 2, 30),

  -- Emergency Fund
  ('topic_fin_emergency_fund', 'social_studies', 'fin_per_emergency', 'Building an Emergency Fund', '3-6 months of expenses', '["Explain purpose of emergency fund", "Calculate target amount", "Choose where to keep emergency funds"]', 2, 25),

  -- Net Worth
  ('topic_fin_assets_liabilities', 'social_studies', 'fin_per_networth', 'Assets and Liabilities', 'What you own vs what you owe', '["Define assets and liabilities", "Identify personal assets/liabilities", "Distinguish appreciating vs depreciating assets"]', 2, 25),
  ('topic_fin_networth_calc', 'social_studies', 'fin_per_networth', 'Calculating Net Worth', 'Assets minus liabilities', '["Calculate net worth", "Track net worth over time", "Interpret net worth changes"]', 2, 20),

  -- Goal Setting
  ('topic_fin_smart_goals', 'social_studies', 'fin_per_goals', 'SMART Financial Goals', 'Specific, Measurable, Achievable, Relevant, Time-bound', '["Write SMART goals", "Prioritize financial goals", "Create action steps"]', 2, 25),
  ('topic_fin_goal_types', 'social_studies', 'fin_per_goals', 'Short, Medium, and Long-Term Goals', 'Planning across time horizons', '["Distinguish goal timeframes", "Align goals with values", "Track goal progress"]', 2, 20);

-- BANKING & CREDIT TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Banks
  ('topic_fin_bank_services', 'social_studies', 'fin_bnk_how_banks_work', 'Bank Services', 'Checking, savings, loans, and more', '["Identify bank services", "Compare checking vs savings accounts", "Understand bank fees"]', 1, 20),
  ('topic_fin_bank_money', 'social_studies', 'fin_bnk_how_banks_work', 'How Banks Make Money', 'Lending deposits at higher rates', '["Explain how banks profit", "Understand fractional reserve banking", "Describe FDIC insurance"]', 2, 25),

  -- Interest
  ('topic_fin_simple_interest', 'social_studies', 'fin_bnk_interest', 'Simple Interest', 'Interest on principal only', '["Calculate simple interest", "Apply formula I = PRT", "Solve simple interest problems"]', 2, 25),
  ('topic_fin_compound_interest', 'social_studies', 'fin_bnk_interest', 'Compound Interest', 'Interest on principal plus interest', '["Calculate compound interest", "Compare compounding frequencies", "Understand exponential growth"]', 2, 30),
  ('topic_fin_rule_72', 'social_studies', 'fin_bnk_interest', 'Rule of 72', 'Quick estimate of doubling time', '["Apply Rule of 72", "Estimate investment doubling", "Understand relationship between rate and time"]', 2, 20),

  -- Credit Scores
  ('topic_fin_credit_score_factors', 'social_studies', 'fin_bnk_credit_scores', 'Credit Score Factors', 'What determines your credit score', '["Identify 5 factors in credit score", "Explain weight of each factor", "Describe credit score ranges"]', 2, 25),
  ('topic_fin_credit_score_improve', 'social_studies', 'fin_bnk_credit_scores', 'Improving Credit Scores', 'Building and maintaining good credit', '["List ways to improve credit", "Avoid common credit mistakes", "Monitor credit reports"]', 2, 20),

  -- Cards
  ('topic_fin_debit_cards', 'social_studies', 'fin_bnk_cards', 'Debit Cards', 'Spending money you have', '["Explain how debit cards work", "Identify benefits of debit cards", "Understand debit card risks"]', 1, 15),
  ('topic_fin_credit_cards', 'social_studies', 'fin_bnk_cards', 'Credit Cards', 'Borrowing to spend', '["Explain how credit cards work", "Calculate credit card interest", "Describe responsible credit card use"]', 2, 25),
  ('topic_fin_card_compare', 'social_studies', 'fin_bnk_cards', 'Credit vs Debit', 'When to use each', '["Compare credit vs debit", "Evaluate credit card offers", "Avoid credit card debt"]', 2, 20),

  -- Loans and Debt
  ('topic_fin_loan_types', 'social_studies', 'fin_bnk_loans', 'Types of Loans', 'Mortgages, auto, student, personal', '["Identify loan types", "Compare secured vs unsecured", "Understand loan terms"]', 2, 25),
  ('topic_fin_loan_costs', 'social_studies', 'fin_bnk_loans', 'True Cost of Loans', 'Principal, interest, fees, and terms', '["Calculate total loan cost", "Compare APR vs interest rate", "Understand amortization"]', 3, 30),
  ('topic_fin_good_bad_debt', 'social_studies', 'fin_bnk_loans', 'Good Debt vs Bad Debt', 'Investing vs consuming', '["Distinguish productive vs consumptive debt", "Evaluate when to borrow", "Create debt payoff strategy"]', 3, 25),

  -- Time Value of Money
  ('topic_fin_time_value', 'social_studies', 'fin_bnk_time_value', 'Present vs Future Value', 'A dollar today vs tomorrow', '["Explain time value of money", "Calculate present/future value", "Apply to financial decisions"]', 3, 30);

-- INVESTING TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Risk and Reward
  ('topic_fin_risk_types', 'social_studies', 'fin_inv_risk_reward', 'Types of Investment Risk', 'Market, inflation, interest rate, etc.', '["Identify investment risks", "Explain risk tolerance", "Assess personal risk tolerance"]', 2, 25),
  ('topic_fin_risk_return', 'social_studies', 'fin_inv_risk_reward', 'Risk-Return Tradeoff', 'Higher risk, higher potential return', '["Explain risk-return relationship", "Compare investment risk levels", "Balance risk and return"]', 2, 25),

  -- Diversification
  ('topic_fin_diversify', 'social_studies', 'fin_inv_diversification', 'Diversification Strategy', 'Do not put all eggs in one basket', '["Explain diversification", "Identify ways to diversify", "Build diversified portfolio"]', 2, 25),
  ('topic_fin_asset_allocation', 'social_studies', 'fin_inv_diversification', 'Asset Allocation', 'Dividing investments across asset classes', '["Explain asset classes", "Describe asset allocation", "Determine appropriate allocation"]', 3, 30),

  -- Stocks and Bonds
  ('topic_fin_stocks', 'social_studies', 'fin_inv_stocks_bonds', 'Stock Basics', 'Owning part of a company', '["Explain stocks as ownership", "Understand stock returns", "Describe stock market"]', 2, 25),
  ('topic_fin_bonds', 'social_studies', 'fin_inv_stocks_bonds', 'Bond Basics', 'Lending money for interest', '["Explain bonds as loans", "Understand bond returns", "Compare stocks vs bonds"]', 2, 25),

  -- Index Funds
  ('topic_fin_index_funds', 'social_studies', 'fin_inv_index_funds', 'Index Funds and ETFs', 'Low-cost diversified investing', '["Explain index funds", "Compare to actively managed funds", "Understand expense ratios"]', 2, 25),

  -- Compound Growth
  ('topic_fin_compound_invest', 'social_studies', 'fin_inv_compound', 'Compound Growth in Investing', 'Exponential wealth building', '["Calculate compound returns", "Understand exponential growth", "Appreciate time in market"]', 2, 30),
  ('topic_fin_start_early', 'social_studies', 'fin_inv_compound', 'Starting Early', 'Time is your greatest asset', '["Compare early vs late investing", "Calculate benefit of time", "Commit to early investing"]', 2, 20),

  -- Dollar Cost Averaging
  ('topic_fin_dca', 'social_studies', 'fin_inv_dca', 'Dollar Cost Averaging', 'Investing consistently over time', '["Explain dollar cost averaging", "Understand benefits of DCA", "Compare to lump sum investing"]', 2, 25),

  -- Long-Term Thinking
  ('topic_fin_long_term', 'social_studies', 'fin_inv_long_term', 'Long-Term Perspective', 'Ignore short-term volatility', '["Adopt long-term mindset", "Understand market volatility", "Avoid emotional investing"]', 2, 20);

-- TAXES & GOVERNMENT TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- How Taxes Work
  ('topic_fin_tax_purpose', 'social_studies', 'fin_tax_how_work', 'Purpose of Taxes', 'Funding government services', '["Explain why taxes exist", "Identify what taxes fund", "Evaluate tax policy"]', 1, 20),
  ('topic_fin_tax_filing', 'social_studies', 'fin_tax_how_work', 'Tax Filing Basics', 'Forms, deadlines, and compliance', '["Identify common tax forms", "Understand filing requirements", "Know key deadlines"]', 2, 25),

  -- Tax Brackets
  ('topic_fin_progressive_tax', 'social_studies', 'fin_tax_brackets', 'Progressive Tax System', 'Higher income, higher rate', '["Explain progressive taxation", "Read tax bracket tables", "Distinguish regressive vs progressive"]', 2, 25),
  ('topic_fin_marginal_vs_effective', 'social_studies', 'fin_tax_brackets', 'Marginal vs Effective Tax Rate', 'Bracket rate vs average rate', '["Calculate marginal tax rate", "Calculate effective tax rate", "Correct common misconceptions"]', 3, 30),

  -- Types of Taxes
  ('topic_fin_income_tax', 'social_studies', 'fin_tax_types', 'Income Tax', 'Tax on earnings', '["Explain federal and state income tax", "Understand withholding", "Calculate income tax"]', 2, 20),
  ('topic_fin_payroll_tax', 'social_studies', 'fin_tax_types', 'Payroll Tax', 'Social Security and Medicare', '["Explain FICA taxes", "Understand payroll deductions", "Calculate payroll tax"]', 2, 20),
  ('topic_fin_sales_property_tax', 'social_studies', 'fin_tax_types', 'Sales and Property Tax', 'Consumption and wealth taxes', '["Explain sales tax", "Explain property tax", "Compare tax types"]', 2, 20),

  -- Government Services
  ('topic_fin_gov_services', 'social_studies', 'fin_tax_services', 'What Taxes Fund', 'Roads, schools, defense, etc.', '["Identify government services", "Explain how taxes fund services", "Evaluate government spending"]', 2, 25),

  -- Public Goods
  ('topic_fin_public_goods', 'social_studies', 'fin_tax_public_goods', 'Public Goods', 'Non-excludable and non-rivalrous', '["Define public goods", "Explain free rider problem", "Identify examples of public goods"]', 3, 25);

-- ENTREPRENEURSHIP & CAREERS TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Income Sources
  ('topic_fin_active_income', 'social_studies', 'fin_ent_income_sources', 'Active Income', 'Trading time for money', '["Explain active income", "Identify active income sources", "Understand limitations of active income"]', 1, 15),
  ('topic_fin_passive_income', 'social_studies', 'fin_ent_income_sources', 'Passive Income', 'Earning without active work', '["Define passive income", "Identify passive income sources", "Understand building passive income"]', 2, 25),

  -- Creating Value
  ('topic_fin_value_creation', 'social_studies', 'fin_ent_value', 'Income from Value Creation', 'Solve problems to earn money', '["Explain value creation", "Identify market needs", "Connect value to income"]', 2, 25),

  -- Business Basics
  ('topic_fin_revenue_costs', 'social_studies', 'fin_ent_business', 'Revenue and Costs', 'Money in vs money out', '["Define revenue", "Categorize costs", "Calculate profit"]', 2, 20),
  ('topic_fin_profit', 'social_studies', 'fin_ent_business', 'Profit and Loss', 'Business success measure', '["Calculate profit/loss", "Explain gross vs net profit", "Understand profit margin"]', 2, 25),

  -- Human Capital
  ('topic_fin_human_capital', 'social_studies', 'fin_ent_human_capital', 'Investing in Yourself', 'Education and skill development', '["Define human capital", "Evaluate education ROI", "Identify valuable skills"]', 2, 25),
  ('topic_fin_skill_building', 'social_studies', 'fin_ent_human_capital', 'Skill Development', 'Building valuable capabilities', '["Identify in-demand skills", "Create learning plan", "Track skill development"]', 2, 20),

  -- Career Planning
  ('topic_fin_career_research', 'social_studies', 'fin_ent_career_planning', 'Career Research', 'Exploring options and requirements', '["Research career paths", "Identify education requirements", "Understand salary ranges"]', 2, 25),
  ('topic_fin_career_fit', 'social_studies', 'fin_ent_career_planning', 'Career Fit', 'Matching interests and market demand', '["Assess interests and strengths", "Evaluate market demand", "Find career alignment"]', 2, 25),

  -- Negotiation
  ('topic_fin_salary_negotiation', 'social_studies', 'fin_ent_negotiation', 'Salary Negotiation', 'Maximizing compensation', '["Research market rates", "Prepare negotiation strategy", "Practice negotiation tactics"]', 3, 30);

-- CONSUMER PROTECTION TOPICS
INSERT OR IGNORE INTO hyro_curriculum_topics (id, domain, standard_id, topic, description, learning_objectives, difficulty_tier, estimated_minutes) VALUES
  -- Scams
  ('topic_fin_common_scams', 'social_studies', 'fin_con_scams', 'Common Financial Scams', 'Phishing, pyramid schemes, etc.', '["Identify common scams", "Recognize red flags", "Report scams"]', 2, 25),
  ('topic_fin_scam_prevention', 'social_studies', 'fin_con_scams', 'Scam Prevention', 'Protecting yourself', '["Verify before trusting", "Protect personal information", "Question too-good-to-be-true offers"]', 2, 20),

  -- Contracts
  ('topic_fin_reading_contracts', 'social_studies', 'fin_con_contracts', 'Reading Contracts', 'Understanding terms and conditions', '["Identify key contract elements", "Read fine print", "Ask questions before signing"]', 2, 25),
  ('topic_fin_contract_obligations', 'social_studies', 'fin_con_contracts', 'Contract Obligations', 'What you are agreeing to', '["Understand legal obligations", "Identify exit clauses", "Know cancellation policies"]', 2, 20),

  -- Insurance
  ('topic_fin_insurance_basics', 'social_studies', 'fin_con_insurance', 'How Insurance Works', 'Pooling risk and premiums', '["Explain insurance concept", "Define premiums, deductibles, coverage", "Understand risk transfer"]', 2, 25),
  ('topic_fin_insurance_types', 'social_studies', 'fin_con_insurance', 'Types of Insurance', 'Health, auto, life, etc.', '["Identify insurance types", "Evaluate coverage needs", "Compare insurance policies"]', 2, 25),

  -- Advertising
  ('topic_fin_advertising_tactics', 'social_studies', 'fin_con_advertising', 'Advertising Tactics', 'How ads influence you', '["Identify persuasion techniques", "Recognize emotional appeals", "Question advertising claims"]', 2, 20),
  ('topic_fin_critical_consumer', 'social_studies', 'fin_con_advertising', 'Being a Critical Consumer', 'Making informed decisions', '["Research before buying", "Compare alternatives", "Resist impulse purchases"]', 2, 20),

  -- Consumer Rights
  ('topic_fin_consumer_rights', 'social_studies', 'fin_con_rights', 'Know Your Rights', 'Legal protections for consumers', '["Identify consumer rights", "Understand warranties", "Know return policies"]', 2, 20),
  ('topic_fin_consumer_recourse', 'social_studies', 'fin_con_rights', 'Seeking Recourse', 'What to do when things go wrong', '["File complaints", "Seek refunds", "Contact consumer protection agencies"]', 2, 20);

-- ============================================================================
-- QUESTION BANK - Comprehensive assessment questions
-- ============================================================================

INSERT OR IGNORE INTO hyro_question_bank (id, domain, standard_id, topic_id, question_type, question_text, answer_options, correct_answer, explanation, difficulty, difficulty_tier, bloom_level, dok_level, hints) VALUES

  -- ========== ECONOMIC FOUNDATIONS QUESTIONS ==========

  -- Scarcity and Opportunity Cost
  ('q_fin_eco_001', 'social_studies', 'fin_eco_scarcity', 'topic_fin_scarcity', 'multiple_choice', 'Which of the following BEST defines scarcity?', '["Having too many choices", "Unlimited wants and limited resources", "Not having enough money", "Running out of time"]', 'Unlimited wants and limited resources', 'Scarcity is the fundamental economic problem: people have unlimited wants but resources (time, money, materials) are limited. This requires making choices.', 30, 1, 'understand', 1, '["Think about resources vs wants", "What problem forces us to make choices?"]'),

  ('q_fin_eco_002', 'social_studies', 'fin_eco_scarcity', 'topic_fin_opp_cost', 'multiple_choice', 'You have $20. You can either buy a new video game or go to the movies with friends. If you choose the video game, what is your opportunity cost?', '["$20", "The video game", "The experience of going to movies with friends", "Nothing, because you still have the $20 worth of value"]', 'The experience of going to movies with friends', 'Opportunity cost is the value of the next best alternative you give up. By choosing the video game, you give up the movie experience with friends.', 40, 2, 'apply', 2, '["What do you give up when you choose the video game?", "It is not about money but the alternative"]'),

  ('q_fin_eco_003', 'social_studies', 'fin_eco_scarcity', 'topic_fin_opp_cost', 'multiple_choice', 'A farmer can use an acre of land to grow either 100 bushels of wheat or 50 bushels of corn. What is the opportunity cost of growing 100 bushels of wheat?', '["50 bushels of corn", "100 bushels of corn", "150 bushels total", "$100"]', '50 bushels of corn', 'By using the land for wheat, the farmer gives up the ability to grow 50 bushels of corn. That is the opportunity cost.', 45, 2, 'apply', 2, '["What could have been produced instead?", "Think about what is given up"]'),

  -- Supply and Demand
  ('q_fin_eco_004', 'social_studies', 'fin_eco_supply_demand', 'topic_fin_demand', 'multiple_choice', 'According to the law of demand, when the price of pizza increases, what happens to the quantity demanded (assuming all else stays the same)?', '["Quantity demanded increases", "Quantity demanded decreases", "Quantity demanded stays the same", "Demand curve shifts right"]', 'Quantity demanded decreases', 'The law of demand states that as price increases, quantity demanded decreases (and vice versa), assuming other factors remain constant.', 35, 2, 'understand', 1, '["Higher prices mean less people buy", "Think about your own behavior"]'),

  ('q_fin_eco_005', 'social_studies', 'fin_eco_supply_demand', 'topic_fin_supply', 'multiple_choice', 'According to the law of supply, when the price of sneakers increases, what happens to the quantity supplied?', '["Quantity supplied increases", "Quantity supplied decreases", "Quantity supplied stays the same", "Supply curve shifts left"]', 'Quantity supplied increases', 'The law of supply states that as price increases, producers are willing to supply more (because higher prices mean higher profits).', 35, 2, 'understand', 1, '["Higher prices incentivize producers to sell more", "Think about profit motive"]'),

  ('q_fin_eco_006', 'social_studies', 'fin_eco_supply_demand', 'topic_fin_equilibrium', 'multiple_choice', 'At market equilibrium, what is true?', '["Quantity demanded equals quantity supplied", "Price is at its lowest", "Everyone who wants the product can afford it", "There is a shortage"]', 'Quantity demanded equals quantity supplied', 'Equilibrium occurs where the demand and supply curves intersect - the quantity buyers want to purchase equals the quantity sellers want to sell.', 40, 2, 'understand', 2, '["Where do supply and demand meet?", "Think about balance"]'),

  ('q_fin_eco_007', 'social_studies', 'fin_eco_supply_demand', 'topic_fin_equilibrium', 'multiple_choice', 'A new study shows that blueberries prevent cancer. What will likely happen to the equilibrium price and quantity of blueberries?', '["Price increases, quantity increases", "Price decreases, quantity increases", "Price increases, quantity decreases", "Price decreases, quantity decreases"]', 'Price increases, quantity increases', 'The study increases demand (shifts demand curve right). Higher demand leads to higher equilibrium price and quantity.', 50, 3, 'analyze', 3, '["Does this affect supply or demand?", "Which direction does demand shift?", "What happens to price and quantity when demand increases?"]'),

  -- Marginal Thinking
  ('q_fin_eco_008', 'social_studies', 'fin_eco_marginal', 'topic_fin_marginal_benefit', 'multiple_choice', 'You are eating pizza. The first slice gives you great satisfaction. The fourth slice makes you feel full and less satisfied. This illustrates:', '["Increasing marginal benefit", "Diminishing marginal benefit", "Opportunity cost", "Scarcity"]', 'Diminishing marginal benefit', 'Diminishing marginal benefit means each additional unit provides less additional satisfaction than the previous one. Your fourth slice provides less benefit than your first.', 40, 2, 'apply', 2, '["How does satisfaction change with each slice?", "Does each slice provide the same benefit?"]'),

  ('q_fin_eco_009', 'social_studies', 'fin_eco_marginal', 'topic_fin_marginal_decisions', 'multiple_choice', 'You should continue an activity as long as:', '["The total benefit exceeds total cost", "The marginal benefit exceeds marginal cost", "You have time remaining", "It makes you happy"]', 'The marginal benefit exceeds marginal cost', 'Rational decision-making involves continuing an activity until marginal benefit equals marginal cost. As long as MB > MC, you gain from doing one more unit.', 50, 3, 'analyze', 2, '["Think about one more unit", "Compare additional benefit to additional cost"]'),

  -- Incentives
  ('q_fin_eco_010', 'social_studies', 'fin_eco_incentives', 'topic_fin_incentives_basics', 'multiple_choice', 'Which is an example of a positive incentive?', '["A speeding ticket for driving too fast", "A bonus for exceeding sales targets", "Detention for being late to class", "A tax on cigarettes"]', 'A bonus for exceeding sales targets', 'A positive incentive rewards desired behavior. The bonus encourages salespeople to sell more. The other options are negative incentives (punishments).', 35, 2, 'apply', 2, '["Which option rewards behavior?", "Positive means reward, negative means punishment"]'),

  ('q_fin_eco_011', 'social_studies', 'fin_eco_incentives', 'topic_fin_incentives_predict', 'multiple_choice', 'A city wants to reduce plastic bag use. They start charging $0.10 per plastic bag at stores. What is the MOST likely outcome?', '["Everyone stops using plastic bags immediately", "Plastic bag use decreases but does not go to zero", "Plastic bag use increases", "No change in behavior"]', 'Plastic bag use decreases but does not go to zero', 'The fee creates a negative incentive (cost) for using plastic bags. Most people will reduce usage, but some will still pay the fee. Incentives change behavior on the margin.', 45, 3, 'analyze', 3, '["Does the fee make plastic bags more or less attractive?", "Will everyone respond the same way?"]'),

  -- Markets and Price Signals
  ('q_fin_eco_012', 'social_studies', 'fin_eco_markets', 'topic_fin_price_signals', 'multiple_choice', 'After a hurricane, the price of plywood increases significantly. This price increase signals:', '["Price gouging by greedy sellers", "That plywood is now scarce relative to demand", "Market failure", "Government intervention is needed"]', 'That plywood is now scarce relative to demand', 'Prices signal scarcity. The higher price tells consumers to conserve plywood (use less) and tells suppliers to provide more. It coordinates behavior without central planning.', 50, 3, 'analyze', 3, '["What information does the price communicate?", "Think about scarcity and coordination"]'),

  -- Trade and Comparative Advantage
  ('q_fin_eco_013', 'social_studies', 'fin_eco_trade', 'topic_fin_absolute_advantage', 'multiple_choice', 'Country A can produce 100 cars or 200 computers. Country B can produce 50 cars or 75 computers. Which country has absolute advantage in producing cars?', '["Country A", "Country B", "Both countries", "Neither country"]', 'Country A', 'Country A can produce more cars (100 vs 50) with the same resources. Absolute advantage means being able to produce more of something.', 40, 2, 'apply', 2, '["Which country can produce more cars?", "Absolute advantage is about total production"]'),

  ('q_fin_eco_014', 'social_studies', 'fin_eco_trade', 'topic_fin_comparative_advantage', 'multiple_choice', 'You can mow a lawn in 1 hour or wash a car in 30 minutes. Your friend can mow a lawn in 2 hours or wash a car in 1 hour. Who has comparative advantage in mowing lawns?', '["You", "Your friend", "Both", "Neither"]', 'Your friend', 'Your opportunity cost of mowing is 2 car washes (you give up 2 car washes in the 1 hour). Your friend''s opportunity cost is 2 car washes (gives up 2 car washes in 2 hours). Wait - let me recalculate: You give up 2 car washes. Friend gives up 2 car washes. Actually, you can wash 2 cars in 1 hour, friend can wash 1 car in 1 hour, so friend only gives up 1 car wash for mowing. Friend has lower opportunity cost for mowing.', 55, 3, 'apply', 3, '["Calculate opportunity cost for each person", "Who gives up less to mow?", "Opportunity cost = what you give up / what you get"]'),

  -- Externalities
  ('q_fin_eco_015', 'social_studies', 'fin_eco_externalities', 'topic_fin_externalities', 'multiple_choice', 'A factory pollutes a river, harming fish and people downstream who did not buy the factory''s products. This is an example of:', '["A positive externality", "A negative externality", "Market equilibrium", "Opportunity cost"]', 'A negative externality', 'A negative externality occurs when a cost spills over to third parties who were not involved in the transaction. The pollution harms others.', 40, 2, 'apply', 2, '["Does this help or harm third parties?", "Are external people affected?"]'),

  -- ========== PERSONAL FINANCE QUESTIONS ==========

  -- Income and Expenses
  ('q_fin_per_001', 'social_studies', 'fin_per_income', 'topic_fin_income_types', 'multiple_choice', 'Which is an example of passive income?', '["Salary from your job", "Hourly wages", "Rental income from property you own", "Freelance project payment"]', 'Rental income from property you own', 'Passive income is earned without active work. Rental income comes in whether you work that day or not. The others require active labor.', 35, 2, 'apply', 2, '["Which income requires no active work?", "Think about earning while you sleep"]'),

  ('q_fin_per_002', 'social_studies', 'fin_per_income', 'topic_fin_expenses', 'multiple_choice', 'Which expense is FIXED (stays the same each month)?', '["Groceries", "Entertainment", "Rent", "Gas for your car"]', 'Rent', 'Fixed expenses stay the same each month (rent, car payment, insurance). Variable expenses change (groceries, gas, entertainment).', 30, 1, 'understand', 1, '["Which stays the same every month?", "Fixed means unchanging"]'),

  ('q_fin_per_003', 'social_studies', 'fin_per_income', 'topic_fin_expenses', 'multiple_choice', 'Your gross income is $3,000/month. After taxes and deductions, you receive $2,400. What is your net income?', '["$3,000", "$2,400", "$600", "Cannot determine"]', '$2,400', 'Net income is what you actually receive after taxes and deductions (take-home pay). Gross income is before deductions.', 30, 2, 'apply', 1, '["Net income is take-home pay", "It is after deductions"]'),

  -- Budgeting
  ('q_fin_per_004', 'social_studies', 'fin_per_budgeting', 'topic_fin_budget_basics', 'multiple_choice', 'What is the first step in creating a budget?', '["Cut all unnecessary expenses", "List all your income sources", "Open a savings account", "Pay off debt"]', 'List all your income sources', 'You need to know how much money is coming in before you can plan how to spend/save it. Income is the foundation of a budget.', 25, 1, 'understand', 1, '["What do you need to know first?", "Money coming in before money going out"]'),

  ('q_fin_per_005', 'social_studies', 'fin_per_budgeting', 'topic_fin_budget_methods', 'multiple_choice', 'In the 50/30/20 budgeting rule, what does the 20% represent?', '["Needs", "Wants", "Savings and debt repayment", "Taxes"]', 'Savings and debt repayment', 'The 50/30/20 rule suggests: 50% needs, 30% wants, 20% savings/debt repayment. The 20% builds wealth and pays down debt.', 35, 2, 'understand', 1, '["What are the three categories?", "Which percentage is for building wealth?"]'),

  ('q_fin_per_006', 'social_studies', 'fin_per_budgeting', 'topic_fin_budget_adjust', 'multiple_choice', 'Your car breaks down and costs $800 to repair, but you only budgeted $100 for car maintenance this month. What is the BEST response?', '["Ignore your budget this month", "Pull money from your emergency fund and adjust next month''s budget", "Put the repair on a high-interest credit card", "Do not fix the car"]', 'Pull money from your emergency fund and adjust next month''s budget', 'This is exactly what an emergency fund is for. Use it for the unexpected expense, then adjust your budget to rebuild the fund. Avoid high-interest debt when possible.', 50, 3, 'evaluate', 3, '["What is an emergency fund for?", "Which option avoids debt and keeps you safe?"]'),

  -- Saving
  ('q_fin_per_007', 'social_studies', 'fin_per_saving', 'topic_fin_saving_why', 'multiple_choice', 'What is the PRIMARY benefit of saving money regularly?', '["To impress others", "To have money for future goals and emergencies", "To avoid paying taxes", "To spend more later"]', 'To have money for future goals and emergencies', 'Saving provides financial security for emergencies and allows you to achieve future goals (college, house, retirement) without going into debt.', 30, 1, 'understand', 1, '["Why do people save?", "Think about future needs"]'),

  ('q_fin_per_008', 'social_studies', 'fin_per_saving', 'topic_fin_pay_yourself_first', 'multiple_choice', 'What does "pay yourself first" mean?', '["Buy what you want before paying bills", "Save money before spending on other things", "Pay cash for everything", "Give yourself a salary"]', 'Save money before spending on other things', 'Pay yourself first means treating saving like a bill - set aside savings immediately when you get paid, before spending on other things. This ensures saving actually happens.', 35, 2, 'understand', 2, '["When should you save?", "What does first mean?"]'),

  ('q_fin_per_009', 'social_studies', 'fin_per_saving', 'topic_fin_compound_saving', 'multiple_choice', 'You deposit $1,000 in an account earning 5% annual interest, compounded annually. How much will you have after 1 year?', '["$1,000", "$1,050", "$1,500", "$5,000"]', '$1,050', 'After 1 year: $1,000 × (1 + 0.05) = $1,000 × 1.05 = $1,050. You earn $50 in interest.', 35, 2, 'apply', 2, '["Multiply principal by (1 + interest rate)", "$1,000 × 1.05"]'),

  -- Emergency Fund
  ('q_fin_per_010', 'social_studies', 'fin_per_emergency', 'topic_fin_emergency_fund', 'multiple_choice', 'Financial experts typically recommend an emergency fund of:', '["$500", "1 month of expenses", "3-6 months of expenses", "1 year of income"]', '3-6 months of expenses', 'A 3-6 month emergency fund provides a cushion for job loss, medical emergencies, or major unexpected expenses. The exact amount depends on your situation.', 40, 2, 'understand', 1, '["How long should the fund last?", "Think about covering expenses, not income"]'),

  ('q_fin_per_011', 'social_studies', 'fin_per_emergency', 'topic_fin_emergency_fund', 'multiple_choice', 'Where should you keep your emergency fund?', '["In stocks for growth", "In a high-risk investment", "In a savings account with easy access", "In cash under your mattress"]', 'In a savings account with easy access', 'Emergency funds should be easily accessible (liquid) and safe (not at risk of losing value). A savings account is ideal - better than under mattress (no interest, theft risk) and safer than stocks.', 40, 2, 'evaluate', 2, '["Does it need to be safe or risky?", "Do you need quick access?"]'),

  -- Net Worth
  ('q_fin_per_012', 'social_studies', 'fin_per_networth', 'topic_fin_assets_liabilities', 'multiple_choice', 'Which of the following is a LIABILITY?', '["Your savings account balance", "Your car", "Your student loan debt", "Your house"]', 'Your student loan debt', 'Liabilities are what you OWE (debts). Assets are what you OWN. Student loan debt is money you owe, so it is a liability.', 30, 2, 'apply', 1, '["Liabilities are what you owe", "Which is a debt?"]'),

  ('q_fin_per_013', 'social_studies', 'fin_per_networth', 'topic_fin_networth_calc', 'multiple_choice', 'You have $5,000 in savings, a car worth $12,000, and student loans of $8,000. What is your net worth?', '["$17,000", "$9,000", "$25,000", "$5,000"]', '$9,000', 'Net worth = Assets - Liabilities = ($5,000 + $12,000) - $8,000 = $17,000 - $8,000 = $9,000.', 40, 2, 'apply', 2, '["Add up all assets", "Subtract all liabilities", "Assets - Liabilities"]'),

  -- Goal Setting
  ('q_fin_per_014', 'social_studies', 'fin_per_goals', 'topic_fin_smart_goals', 'multiple_choice', 'Which is a SMART financial goal?', '["I want to save more money", "I will be rich someday", "I will save $3,000 for a car down payment by December 31", "I should probably start investing"]', 'I will save $3,000 for a car down payment by December 31', 'SMART goals are Specific ($3,000), Measurable (can track progress), Achievable (realistic), Relevant (for a car), Time-bound (by Dec 31). The other options are vague.', 40, 2, 'evaluate', 2, '["Which is specific and measurable?", "Which has a deadline?"]'),

  -- ========== BANKING & CREDIT QUESTIONS ==========

  -- Banks
  ('q_fin_bnk_001', 'social_studies', 'fin_bnk_how_banks_work', 'topic_fin_bank_services', 'multiple_choice', 'What is the main difference between a checking account and a savings account?', '["Checking is for frequent transactions, savings is for storing money and earning interest", "Checking earns more interest", "Savings allows unlimited withdrawals", "No difference"]', 'Checking is for frequent transactions, savings is for storing money and earning interest', 'Checking accounts are designed for frequent deposits and withdrawals (paying bills, debit card). Savings accounts are for storing money, earning interest, and have limited withdrawals.', 30, 1, 'understand', 1, '["Which is for daily use?", "Which is for saving?"]'),

  ('q_fin_bnk_002', 'social_studies', 'fin_bnk_how_banks_work', 'topic_fin_bank_money', 'multiple_choice', 'How do banks primarily make money?', '["Charging monthly fees", "Borrowing at low rates and lending at higher rates", "Government subsidies", "Selling stocks"]', 'Borrowing at low rates and lending at higher rates', 'Banks pay you low interest on deposits (e.g., 1%) and charge higher interest on loans (e.g., 6%). The spread is their profit.', 40, 2, 'understand', 2, '["Think about interest rates", "Where do banks get money? Where does it go?"]'),

  -- Interest
  ('q_fin_bnk_003', 'social_studies', 'fin_bnk_interest', 'topic_fin_simple_interest', 'multiple_choice', 'You borrow $500 at 10% simple annual interest for 2 years. How much interest will you pay?', '["$50", "$100", "$600", "$1,000"]', '$100', 'Simple interest formula: I = PRT = $500 × 0.10 × 2 = $100.', 40, 2, 'apply', 2, '["Use formula I = PRT", "P = $500, R = 0.10, T = 2"]'),

  ('q_fin_bnk_004', 'social_studies', 'fin_bnk_interest', 'topic_fin_compound_interest', 'multiple_choice', 'Why is compound interest more powerful than simple interest for savings?', '["It is not, they are the same", "You earn interest on previously earned interest", "The interest rate is higher", "Banks prefer it"]', 'You earn interest on previously earned interest', 'Compound interest means you earn interest on your principal PLUS previously earned interest. This creates exponential growth over time.', 40, 2, 'understand', 2, '["What makes compound different?", "Interest on interest"]'),

  ('q_fin_bnk_005', 'social_studies', 'fin_bnk_interest', 'topic_fin_rule_72', 'multiple_choice', 'Using the Rule of 72, approximately how long will it take your money to double at 6% annual interest?', '["6 years", "12 years", "72 years", "432 years"]', '12 years', 'Rule of 72: Years to double ≈ 72 ÷ interest rate = 72 ÷ 6 = 12 years.', 40, 2, 'apply', 2, '["Divide 72 by the interest rate", "72 ÷ 6 = ?"]'),

  -- Credit Scores
  ('q_fin_bnk_006', 'social_studies', 'fin_bnk_credit_scores', 'topic_fin_credit_score_factors', 'multiple_choice', 'Which factor has the BIGGEST impact on your credit score?', '["Payment history (paying bills on time)", "Types of credit used", "New credit inquiries", "Your income"]', 'Payment history (paying bills on time)', 'Payment history is about 35% of your credit score - the largest factor. Paying all bills on time is the most important thing you can do for your credit.', 40, 2, 'understand', 1, '["Which shows you are reliable?", "What matters most to lenders?"]'),

  ('q_fin_bnk_007', 'social_studies', 'fin_bnk_credit_scores', 'topic_fin_credit_score_improve', 'multiple_choice', 'Which action will HELP your credit score?', '["Maxing out your credit cards", "Applying for many credit cards in a short time", "Paying your credit card bill on time every month", "Closing old credit cards"]', 'Paying your credit card bill on time every month', 'On-time payments build payment history (biggest factor). Maxing out cards hurts credit utilization. Too many applications hurt. Closing old cards reduces credit history length.', 40, 2, 'evaluate', 2, '["What shows you are responsible?", "Which builds good payment history?"]'),

  -- Cards
  ('q_fin_bnk_008', 'social_studies', 'fin_bnk_cards', 'topic_fin_debit_cards', 'multiple_choice', 'When you use a debit card, where does the money come from?', '["You borrow from the bank", "Your checking account", "Your credit limit", "The merchant"]', 'Your checking account', 'A debit card withdraws money directly from your checking account. You are spending your own money, not borrowing.', 25, 1, 'understand', 1, '["Is it your money or borrowed?", "Which account is connected?"]'),

  ('q_fin_bnk_009', 'social_studies', 'fin_bnk_cards', 'topic_fin_credit_cards', 'multiple_choice', 'You charge $1,000 on a credit card with 18% APR. If you only pay the minimum and take a year to pay it off, approximately how much will you pay in interest?', '["$0", "$50", "$90", "$180"]', '$90', 'Approximate interest on $1,000 at 18% over a year is roughly $90 (actual amount depends on payment schedule, but this is close). The key point: carrying a balance costs you significantly.', 50, 3, 'apply', 2, '["Interest is about 18% of balance", "Over a year, roughly half that on average"]'),

  ('q_fin_bnk_010', 'social_studies', 'fin_bnk_cards', 'topic_fin_card_compare', 'multiple_choice', 'What is the BEST reason to use a credit card instead of a debit card?', '["To spend money you do not have", "To build credit history and earn rewards, if you pay in full each month", "Credit cards are always free", "Debit cards are unsafe"]', 'To build credit history and earn rewards, if you pay in full each month', 'Responsible credit card use (paying in full, no interest) builds credit and can earn rewards. The key is paying in full. Using credit to spend money you do not have leads to debt.', 45, 3, 'evaluate', 3, '["What benefit requires paying in full?", "Think about responsible use"]'),

  -- Loans and Debt
  ('q_fin_bnk_011', 'social_studies', 'fin_bnk_loans', 'topic_fin_loan_types', 'multiple_choice', 'Which type of loan is SECURED by collateral?', '["Credit card debt", "Student loan", "Car loan", "Personal loan"]', 'Car loan', 'A secured loan requires collateral (an asset the lender can take if you do not pay). Car loans are secured by the car. Unsecured loans have no collateral.', 40, 2, 'understand', 2, '["Which has something to take back?", "Secured means backed by an asset"]'),

  ('q_fin_bnk_012', 'social_studies', 'fin_bnk_loans', 'topic_fin_good_bad_debt', 'multiple_choice', 'Which is an example of potentially "good debt"?', '["Credit card debt from vacations", "A loan to buy a car you cannot afford", "A student loan for education that increases earning potential", "A payday loan"]', 'A student loan for education that increases earning potential', 'Good debt invests in assets that increase in value or earning potential. Education can increase income. Bad debt funds consumption or depreciating assets.', 45, 3, 'evaluate', 3, '["Which debt builds future earning?", "Which is an investment vs consumption?"]'),

  -- ========== INVESTING QUESTIONS ==========

  -- Risk and Reward
  ('q_fin_inv_001', 'social_studies', 'fin_inv_risk_reward', 'topic_fin_risk_return', 'multiple_choice', 'Which investment typically has the HIGHEST long-term return potential but also the HIGHEST risk?', '["Savings account", "Government bonds", "Stocks", "Certificate of Deposit (CD)"]', 'Stocks', 'Stocks have historically provided the highest long-term returns but also the most volatility (risk). Savings accounts and bonds are safer but lower return.', 40, 2, 'understand', 2, '["Which fluctuates most in value?", "Risk and return move together"]'),

  -- Diversification
  ('q_fin_inv_002', 'social_studies', 'fin_inv_diversification', 'topic_fin_diversify', 'multiple_choice', 'Why should you diversify your investments?', '["To maximize returns", "To reduce risk by spreading investments across different assets", "It is required by law", "To avoid taxes"]', 'To reduce risk by spreading investments across different assets', 'Diversification is about risk management. By spreading across different investments, you reduce the impact of any single investment performing poorly. Do not put all eggs in one basket.', 40, 2, 'understand', 2, '["What happens if one investment fails?", "Think about spreading risk"]'),

  ('q_fin_inv_003', 'social_studies', 'fin_inv_diversification', 'topic_fin_asset_allocation', 'multiple_choice', 'Asset allocation means:', '["Picking individual stocks", "Dividing investments among different asset classes like stocks, bonds, and cash", "Buying only stocks", "Selling investments"]', 'Dividing investments among different asset classes like stocks, bonds, and cash', 'Asset allocation is deciding what percentage of your portfolio goes into different asset classes (stocks, bonds, real estate, etc.) based on your goals and risk tolerance.', 40, 2, 'understand', 2, '["How do you divide your portfolio?", "Think about categories of investments"]'),

  -- Stocks and Bonds
  ('q_fin_inv_004', 'social_studies', 'fin_inv_stocks_bonds', 'topic_fin_stocks', 'multiple_choice', 'When you buy stock in a company, you are:', '["Lending money to the company", "Buying ownership in the company", "Paying the company''s debts", "Buying the company''s products"]', 'Buying ownership in the company', 'Stock represents ownership (equity) in a company. As an owner, you share in profits (through dividends or stock price appreciation) and risks.', 35, 2, 'understand', 1, '["Are you an owner or lender?", "Stock = ownership"]'),

  ('q_fin_inv_005', 'social_studies', 'fin_inv_stocks_bonds', 'topic_fin_bonds', 'multiple_choice', 'When you buy a bond, you are:', '["Buying ownership in a company", "Lending money to the bond issuer", "Buying a physical asset", "Investing in real estate"]', 'Lending money to the bond issuer', 'A bond is a loan. You lend money to a government or company, and they pay you back with interest. You are a lender, not an owner.', 35, 2, 'understand', 1, '["Are you an owner or lender?", "Bond = loan"]'),

  -- Index Funds
  ('q_fin_inv_006', 'social_studies', 'fin_inv_index_funds', 'topic_fin_index_funds', 'multiple_choice', 'What is the main advantage of index funds over actively managed funds?', '["Higher returns guaranteed", "Lower fees and automatic diversification", "More exciting", "Less regulation"]', 'Lower fees and automatic diversification', 'Index funds have very low fees (since they just track an index, not actively managed) and automatic diversification (they own all stocks in the index). Over time, low fees significantly impact returns.', 45, 2, 'understand', 2, '["What do index funds save on?", "Think about costs and spreading risk"]'),

  -- Compound Growth
  ('q_fin_inv_007', 'social_studies', 'fin_inv_compound', 'topic_fin_start_early', 'multiple_choice', 'Person A invests $200/month from age 25-35 (10 years, $24,000 total) then stops. Person B invests $200/month from age 35-65 (30 years, $72,000 total). Assuming 8% annual return, who likely has more at age 65?', '["Person A", "Person B", "They have the same", "Cannot determine"]', 'Person A', 'Person A benefits from 40 years of compound growth (even though they only contributed for 10). Person B only gets 30 years of compounding. Starting early is incredibly powerful due to exponential growth.', 55, 3, 'analyze', 3, '["Who has more time for compounding?", "Early money grows longer", "Compound growth is exponential"]'),

  -- Dollar Cost Averaging
  ('q_fin_inv_008', 'social_studies', 'fin_inv_dca', 'topic_fin_dca', 'multiple_choice', 'Dollar cost averaging means:', '["Buying stocks only when prices are low", "Investing a fixed amount at regular intervals regardless of price", "Selling investments regularly", "Averaging your returns"]', 'Investing a fixed amount at regular intervals regardless of price', 'DCA means investing the same amount regularly (e.g., $200/month) regardless of whether the market is up or down. This reduces timing risk and builds discipline.', 40, 2, 'understand', 2, '["Do you try to time the market?", "Regular, consistent investing"]'),

  -- ========== TAXES & GOVERNMENT QUESTIONS ==========

  -- How Taxes Work
  ('q_fin_tax_001', 'social_studies', 'fin_tax_how_work', 'topic_fin_tax_purpose', 'multiple_choice', 'What is the primary purpose of taxes?', '["To punish the wealthy", "To fund government services and programs", "To reduce economic growth", "To create jobs at the IRS"]', 'To fund government services and programs', 'Taxes fund public goods and services like roads, schools, military, police, courts, etc. that benefit society.', 30, 1, 'understand', 1, '["What do taxes pay for?", "Think about government services"]'),

  -- Tax Brackets
  ('q_fin_tax_002', 'social_studies', 'fin_tax_brackets', 'topic_fin_progressive_tax', 'multiple_choice', 'In a progressive tax system, as your income increases:', '["Your tax rate stays the same", "Your tax rate decreases", "Your tax rate increases", "You pay no taxes"]', 'Your tax rate increases', 'Progressive taxation means higher incomes pay higher tax rates. As you earn more, you move into higher tax brackets.', 35, 2, 'understand', 1, '["Progressive means increasing", "Higher income = higher rate"]'),

  ('q_fin_tax_003', 'social_studies', 'fin_tax_brackets', 'topic_fin_marginal_vs_effective', 'multiple_choice', 'You earn $50,000. Tax brackets are: 10% on first $10,000, 12% on next $30,000, 22% on income above $40,000. What is your marginal tax rate?', '["10%", "12%", "22%", "15%"]', '22%', 'Marginal tax rate is the rate on your NEXT dollar of income. Since you earn $50,000, your next dollar falls in the 22% bracket (above $40,000).', 50, 3, 'apply', 2, '["Which bracket is your last dollar in?", "Marginal = rate on next dollar"]'),

  ('q_fin_tax_004', 'social_studies', 'fin_tax_brackets', 'topic_fin_marginal_vs_effective', 'multiple_choice', 'Using the same brackets from the previous question, what is your TOTAL tax on $50,000 income?', '["$1,000 + $3,600 + $2,200 = $6,800", "$11,000", "$5,000", "$15,000"]', '$1,000 + $3,600 + $2,200 = $6,800', 'Calculate tax for each bracket: 10% × $10,000 = $1,000, 12% × $30,000 = $3,600, 22% × $10,000 = $2,200. Total = $6,800. This is how progressive taxation works.', 55, 3, 'apply', 3, '["Calculate tax in each bracket separately", "First $10k at 10%, next $30k at 12%, last $10k at 22%"]'),

  -- Types of Taxes
  ('q_fin_tax_005', 'social_studies', 'fin_tax_types', 'topic_fin_income_tax', 'multiple_choice', 'What does income tax apply to?', '["Only investment income", "Money you earn from work and investments", "Only money from jobs", "Only gifts"]', 'Money you earn from work and investments', 'Income tax applies to wages, salaries, interest, dividends, capital gains - most forms of income (with some exceptions).', 35, 2, 'understand', 1, '["What counts as income?", "Work and investments both"]'),

  ('q_fin_tax_006', 'social_studies', 'fin_tax_types', 'topic_fin_sales_property_tax', 'multiple_choice', 'Sales tax is an example of a:', '["Progressive tax", "Regressive tax", "Income tax", "Gift tax"]', 'Regressive tax', 'Sales tax is regressive because lower-income people spend a higher percentage of their income on taxable goods, so they pay a higher percentage of income in sales tax.', 45, 3, 'analyze', 2, '["Do rich and poor pay the same rate?", "Who spends more of their income?"]'),

  -- ========== ENTREPRENEURSHIP & CAREERS QUESTIONS ==========

  -- Income Sources
  ('q_fin_ent_001', 'social_studies', 'fin_ent_income_sources', 'topic_fin_active_income', 'multiple_choice', 'What is a limitation of relying only on active income?', '["It is illegal", "Your income stops when you stop working", "It pays less than passive income", "It is taxed higher"]', 'Your income stops when you stop working', 'Active income requires your time and effort. If you stop working (injury, vacation, retirement), the income stops. Diversifying income sources provides security.', 40, 2, 'analyze', 2, '["What happens when you cannot work?", "Active means trading time for money"]'),

  -- Creating Value
  ('q_fin_ent_002', 'social_studies', 'fin_ent_value', 'topic_fin_value_creation', 'multiple_choice', 'In a market economy, your income primarily depends on:', '["Your education level", "How hard you work", "The value you create for others", "Your age"]', 'The value you create for others', 'In markets, people pay you because you solve their problems or meet their needs. The more value you create for others, the more you can earn.', 45, 3, 'analyze', 2, '["Why do people pay you?", "Think about solving problems"]'),

  -- Business Basics
  ('q_fin_ent_003', 'social_studies', 'fin_ent_business', 'topic_fin_revenue_costs', 'multiple_choice', 'A business has $50,000 in revenue and $35,000 in costs. What is the profit?', '["$50,000", "$35,000", "$15,000", "$85,000"]', '$15,000', 'Profit = Revenue - Costs = $50,000 - $35,000 = $15,000.', 30, 2, 'apply', 1, '["Subtract costs from revenue", "$50,000 - $35,000"]'),

  -- Human Capital
  ('q_fin_ent_004', 'social_studies', 'fin_ent_human_capital', 'topic_fin_human_capital', 'multiple_choice', 'Investing in your human capital means:', '["Buying stocks", "Developing your skills and knowledge", "Starting a business", "Saving money"]', 'Developing your skills and knowledge', 'Human capital is your skills, knowledge, and abilities. Investing in education, training, and skill development increases your earning potential.', 35, 2, 'understand', 2, '["What is human capital?", "Investing in yourself"]'),

  -- Career Planning
  ('q_fin_ent_005', 'social_studies', 'fin_ent_career_planning', 'topic_fin_career_fit', 'multiple_choice', 'When choosing a career, what is MOST important for long-term success?', '["Choosing the highest paying job", "Following what your parents want", "Aligning your interests, skills, and market demand", "Picking something easy"]', 'Aligning your interests, skills, and market demand', 'The best careers match what you enjoy, what you are good at, and what people will pay for. All three factors matter for satisfaction and success.', 45, 3, 'evaluate', 3, '["What creates long-term success?", "Think about fit on multiple dimensions"]'),

  -- ========== CONSUMER PROTECTION QUESTIONS ==========

  -- Scams
  ('q_fin_con_001', 'social_studies', 'fin_con_scams', 'topic_fin_common_scams', 'multiple_choice', 'Which is a red flag for a potential scam?', '["A company with a physical address", "Guaranteed high returns with no risk", "A detailed contract", "Customer reviews"]', 'Guaranteed high returns with no risk', 'If it sounds too good to be true, it probably is. All investments have risk. Guarantees of high returns with no risk are classic scam indicators.', 40, 2, 'apply', 2, '["What sounds too good to be true?", "All investments have risk"]'),

  ('q_fin_con_002', 'social_studies', 'fin_con_scams', 'topic_fin_scam_prevention', 'multiple_choice', 'You receive an email saying you won a lottery you never entered. They ask for your bank information to deposit the winnings. What should you do?', '["Provide your information to claim the prize", "Reply asking for more details", "Delete the email - it is a scam", "Forward it to friends"]', 'Delete the email - it is a scam', 'You cannot win a lottery you did not enter. This is a classic phishing scam trying to steal your financial information. Delete and report.', 35, 2, 'apply', 2, '["Can you win something you did not enter?", "They are asking for sensitive info"]'),

  -- Contracts
  ('q_fin_con_003', 'social_studies', 'fin_con_contracts', 'topic_fin_reading_contracts', 'multiple_choice', 'Before signing a contract, you should:', '["Sign quickly to not miss the deal", "Read the entire contract, including fine print", "Trust that it is fair", "Have a lawyer review every contract"]', 'Read the entire contract, including fine print', 'Always read the full contract before signing. The fine print often contains important terms. You are legally bound once you sign.', 40, 2, 'evaluate', 2, '["What are you agreeing to?", "Once you sign, you are bound"]'),

  -- Insurance
  ('q_fin_con_004', 'social_studies', 'fin_con_insurance', 'topic_fin_insurance_basics', 'multiple_choice', 'What is a deductible in insurance?', '["The monthly payment", "The amount you pay before insurance covers costs", "The maximum the insurance will pay", "A discount"]', 'The amount you pay before insurance covers costs', 'A deductible is your out-of-pocket cost before insurance kicks in. For example, with a $500 deductible, you pay the first $500 of covered expenses.', 40, 2, 'understand', 1, '["What do you pay first?", "Before insurance pays"]'),

  -- Advertising
  ('q_fin_con_005', 'social_studies', 'fin_con_advertising', 'topic_fin_advertising_tactics', 'multiple_choice', 'An ad shows happy, attractive people using a product. This is an example of:', '["Factual information", "Emotional appeal", "Price comparison", "Warranty details"]', 'Emotional appeal', 'Emotional appeals use feelings (happiness, attractiveness, belonging) rather than facts to persuade. Recognizing this helps you make rational decisions.', 35, 2, 'apply', 2, '["Is this about facts or feelings?", "Are they showing logic or emotion?"]'),

  -- Consumer Rights
  ('q_fin_con_006', 'social_studies', 'fin_con_rights', 'topic_fin_consumer_rights', 'multiple_choice', 'You buy a defective product. The store refuses a refund or exchange. What is your BEST next step?', '["Give up", "Post a bad review only", "Review the return policy and contact corporate customer service or consumer protection agency", "Sue the company"]', 'Review the return policy and contact corporate customer service or consumer protection agency', 'Check the return policy (legal contract). Escalate to corporate customer service. If that fails, contact consumer protection agencies. Document everything.', 45, 3, 'evaluate', 3, '["What are your rights?", "Who can help?", "Escalate step by step"]');

-- ============================================================================
-- PREREQUISITES - Define learning dependencies
-- ============================================================================

INSERT OR IGNORE INTO hyro_skill_prerequisites (id, skill_id, skill_type, prerequisite_id, prerequisite_type, strength) VALUES
  -- Economic foundations prerequisites
  ('prereq_fin_001', 'topic_fin_opp_cost', 'topic', 'topic_fin_scarcity', 'topic', 'required'),
  ('prereq_fin_002', 'topic_fin_equilibrium', 'topic', 'topic_fin_demand', 'topic', 'required'),
  ('prereq_fin_003', 'topic_fin_equilibrium', 'topic', 'topic_fin_supply', 'topic', 'required'),
  ('prereq_fin_004', 'topic_fin_marginal_decisions', 'topic', 'topic_fin_marginal_benefit', 'topic', 'required'),
  ('prereq_fin_005', 'topic_fin_marginal_decisions', 'topic', 'topic_fin_marginal_cost', 'topic', 'required'),
  ('prereq_fin_006', 'topic_fin_incentives_predict', 'topic', 'topic_fin_incentives_basics', 'topic', 'required'),
  ('prereq_fin_007', 'topic_fin_comparative_advantage', 'topic', 'topic_fin_absolute_advantage', 'topic', 'recommended'),

  -- Personal finance prerequisites
  ('prereq_fin_008', 'topic_fin_budget_basics', 'topic', 'topic_fin_income_types', 'topic', 'required'),
  ('prereq_fin_009', 'topic_fin_budget_basics', 'topic', 'topic_fin_expenses', 'topic', 'required'),
  ('prereq_fin_010', 'topic_fin_budget_methods', 'topic', 'topic_fin_budget_basics', 'topic', 'required'),
  ('prereq_fin_011', 'topic_fin_budget_adjust', 'topic', 'topic_fin_budget_methods', 'topic', 'required'),
  ('prereq_fin_012', 'topic_fin_pay_yourself_first', 'topic', 'topic_fin_saving_why', 'topic', 'recommended'),
  ('prereq_fin_013', 'topic_fin_networth_calc', 'topic', 'topic_fin_assets_liabilities', 'topic', 'required'),

  -- Banking & credit prerequisites
  ('prereq_fin_014', 'topic_fin_compound_interest', 'topic', 'topic_fin_simple_interest', 'topic', 'required'),
  ('prereq_fin_015', 'topic_fin_rule_72', 'topic', 'topic_fin_compound_interest', 'topic', 'required'),
  ('prereq_fin_016', 'topic_fin_credit_score_improve', 'topic', 'topic_fin_credit_score_factors', 'topic', 'required'),
  ('prereq_fin_017', 'topic_fin_credit_cards', 'topic', 'topic_fin_debit_cards', 'topic', 'recommended'),
  ('prereq_fin_018', 'topic_fin_card_compare', 'topic', 'topic_fin_credit_cards', 'topic', 'required'),
  ('prereq_fin_019', 'topic_fin_loan_costs', 'topic', 'topic_fin_loan_types', 'topic', 'required'),
  ('prereq_fin_020', 'topic_fin_good_bad_debt', 'topic', 'topic_fin_loan_costs', 'topic', 'required'),

  -- Investing prerequisites
  ('prereq_fin_021', 'topic_fin_asset_allocation', 'topic', 'topic_fin_diversify', 'topic', 'required'),
  ('prereq_fin_022', 'topic_fin_bonds', 'topic', 'topic_fin_stocks', 'topic', 'recommended'),
  ('prereq_fin_023', 'topic_fin_index_funds', 'topic', 'topic_fin_diversify', 'topic', 'required'),
  ('prereq_fin_024', 'topic_fin_start_early', 'topic', 'topic_fin_compound_invest', 'topic', 'required'),

  -- Taxes prerequisites
  ('prereq_fin_025', 'topic_fin_marginal_vs_effective', 'topic', 'topic_fin_progressive_tax', 'topic', 'required'),

  -- Entrepreneurship prerequisites
  ('prereq_fin_026', 'topic_fin_profit', 'topic', 'topic_fin_revenue_costs', 'topic', 'required'),
  ('prereq_fin_027', 'topic_fin_skill_building', 'topic', 'topic_fin_human_capital', 'topic', 'required'),
  ('prereq_fin_028', 'topic_fin_career_fit', 'topic', 'topic_fin_career_research', 'topic', 'recommended'),

  -- Consumer protection prerequisites
  ('prereq_fin_029', 'topic_fin_scam_prevention', 'topic', 'topic_fin_common_scams', 'topic', 'required'),
  ('prereq_fin_030', 'topic_fin_contract_obligations', 'topic', 'topic_fin_reading_contracts', 'topic', 'required'),
  ('prereq_fin_031', 'topic_fin_insurance_types', 'topic', 'topic_fin_insurance_basics', 'topic', 'required');
