        // ==========================================
        // CONFIGURATION
        // ==========================================
        const CSV_FILENAME = 'career_data.csv';

        // Internal Fallback Data (For preview purposes or if external file is missing)
        // This ensures the chart works even if the fetch fails in the preview environment.
        const FALLBACK_CSV = `Level,ID,Title,Department,Description,Requirements,NextSteps
Entry Level,csr,Customer Service Rep,General,"The face of Tatil. Handles policy inquiries, client onboarding, and general support.","CXC/CSEC passes, Customer Service experience.",underwriting_asst;claims_clerk;sales_agent
Entry Level,mgtrainee,Management Trainee,General,"Learns core underwriting, claims, and customer service functions while developing leadership skills.","1 Year Working Experience, BSc Degree",underwriting_asst;claims_clerk;sales_agent
Entry Level,admin_clerk,Admin Clerk,Operations,"Supports back-office operations, filing, and data entry.","High attention to detail, MS Office proficiency.",underwriting_asst;claims_clerk
Level 2 (Junior),underwriting_asst,Underwriting Assistant,Underwriting,Assists underwriters in risk assessment and policy issuance.,1-2 years insurance experience.,junior_underwriter
Level 2 (Junior),claims_clerk,Claims Technician,Claims,Processes initial claim reports and documentation.,"Analytical skills, empathy.",junior_adjuster
Level 2 (Junior),sales_agent,Sales Agent,Sales,Direct sales of Life and General insurance products.,"Sales license, aggressive drive.",senior_agent
Level 3 (Specialist),junior_underwriter,Junior Underwriter,Underwriting,Evaluates risks and determines policy terms for standard cases.,"Insurance certification (e.g., LOMA/CII).",senior_underwriter;compliance_officer
Level 3 (Specialist),junior_adjuster,Claims Specialist,Claims,"Investigates claims, determines liability, and negotiates settlements.","Negotiation skills, vehicle/property knowledge.",senior_adjuster;risk_surveyor
Level 3 (Specialist),claims_inspector,Claims Inspector,Claims,"Investigates claims, determines liability, and negotiates settlements.","Negotiation skills, vehicle/property knowledge.",senior_adjuster;risk_surveyor
Level 3 (Specialist),senior_agent,Senior Sales Agent,Sales,High-volume sales producer and mentor to juniors.,Proven track record.,sales_manager
Level 4 (Senior),senior_underwriter,Senior Underwriter,Underwriting,"Handles complex risks, commercial portfolios, and broker relationships.","Advanced certifications, 5+ years experience.",u_manager;ops_manager
Level 4 (Senior),senior_adjuster,Senior Claims Specialist,Claims,Handles major loss claims and complex litigation files.,Deep legal/policy knowledge.,claims_manager
Level 4 (Senior),risk_surveyor,Senior Claims Inspector,Technical,Inspects properties to assess risk profile before coverage.,Technical/Engineering background helpful.,claims_manager
Level 4 (Senior),compliance_officer,Compliance Officer,Legal,Ensures company adherence to insurance regulations and AML laws.,Legal or Auditing background.,ops_manager
Management,u_manager,Underwriting Manager,Underwriting,Oversees the underwriting department profitability and strategy.,"Management experience, MBA preferred.",exec_director
Management,claims_manager,Claims Manager,Claims,Manages the claims department efficiency and loss ratios.,"Strategic planning, crisis management.",exec_director
Management,sales_manager,Sales Manager,Sales,Leads the sales force and sets revenue targets.,"Leadership, motivational skills.",exec_director
Management,ops_manager,Technical Operations Manager,Operations,Oversees daily business operations and IT integration.,Logistics and Systems expertise.,exec_director
Executive,exec_director,"Managing Director / COO",Executive,"Sets company vision, strategy, and high-level governance.",Extensive industry tenure.,`;

        // ==========================================
        // DATA LOADING & PARSING
        // ==========================================
        let CAREER_DATA = [];

        async function init() {
            let csvText = "";
            try {
                // Try to fetch external file (Works in SharePoint)
                const response = await fetch(CSV_FILENAME);
                if (response.ok) {
                    csvText = await response.text();
                    console.log("Loaded external CSV data.");
                } else {
                    throw new Error("File not found (Status " + response.status + ")");
                }
            } catch (err) {
                // Fallback (Works in Preview or if file missing)
                console.warn("Using fallback data (External CSV could not be loaded).");
                csvText = FALLBACK_CSV;
            }

            if(csvText) {
                parseCSVAndBuildData(csvText);
                renderChart();
            } else {
                document.getElementById('error-overlay').style.display = 'flex';
            }
        }

        // Parse CSV Logic
        function parseCSVAndBuildData(csvText) {
            const rows = csvText.split(/\r?\n/);
            const headers = rows[0].split(','); // Assume standard CSV format
            
            // Temporary storage to group by Level
            let levelsMap = {}; // { "Entry Level": [Role, Role], "Level 2": [] }
            // Order of levels based on when they first appear in CSV
            let levelOrder = []; 

            // Helper to handle CSV quotes
            const parseRow = (rowStr) => {
                const result = [];
                let current = '';
                let inQuote = false;
                for (let i = 0; i < rowStr.length; i++) {
                    const char = rowStr[i];
                    if (char === '"') { inQuote = !inQuote; }
                    else if (char === ',' && !inQuote) { result.push(current); current = ''; }
                    else { current += char; }
                }
                result.push(current);
                return result;
            };

            for (let i = 1; i < rows.length; i++) {
                if(!rows[i].trim()) continue; // Skip empty lines
                
                const cols = parseRow(rows[i]);
                // CSV Cols: Level(0), ID(1), Title(2), Dept(3), Desc(4), Req(5), NextSteps(6)
                
                if(cols.length < 3) continue;

                const levelName = cols[0].trim();
                const role = {
                    id: cols[1].trim(),
                    title: cols[2].trim(),
                    dept: cols[3].trim(),
                    desc: cols[4] ? cols[4].trim() : "",
                    req: cols[5] ? cols[5].trim() : "",
                    // Split nextSteps by semicolon
                    nextSteps: cols[6] ? cols[6].split(';').map(s => s.trim()).filter(s => s) : []
                };

                if (!levelsMap[levelName]) {
                    levelsMap[levelName] = [];
                    levelOrder.push(levelName);
                }
                levelsMap[levelName].push(role);
            }

            // Convert back to Array structure required by renderer
            CAREER_DATA = levelOrder.map(lvl => ({
                levelName: lvl,
                roles: levelsMap[lvl]
            }));
        }


        // ==========================================
        // RENDERING LOGIC
        // ==========================================
        const container = document.getElementById('chartContainer');
        const svgLayer = document.getElementById('connections-layer');
        const detailsPanel = {
            title: document.getElementById('detailTitle'),
            level: document.getElementById('detailLevel'),
            desc: document.getElementById('detailDesc'),
            req: document.getElementById('detailReq'),
            reqSection: document.getElementById('reqSection')
        };
        const chartState = { isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0, isDragging: false };
        let cardElements = {}; 
        let connections = []; 

        function renderChart() {
            container.innerHTML = '';
            cardElements = {}; // Reset

            CAREER_DATA.forEach((level) => {
                const col = document.createElement('div');
                col.className = 'level-column';
                
                const header = document.createElement('div');
                header.className = 'level-header';
                header.textContent = level.levelName;
                col.appendChild(header);

                level.roles.forEach(role => {
                    const card = document.createElement('div');
                    card.className = 'role-card';
                    card.id = `card-${role.id}`;
                    card.innerHTML = `
                        <h3>${role.title}</h3>
                        <p>${role.dept}</p>
                        ${role.nextSteps && role.nextSteps.length > 0 ? `<div class="branch-badge" title="Branches">+${role.nextSteps.length}</div>` : ''}
                    `;
                    card.addEventListener('click', (e) => {
                        if (chartState.isDragging) return;
                        selectRole(role);
                    });
                    col.appendChild(card);
                    cardElements[role.id] = { element: card, data: role };
                });
                container.appendChild(col);
            });
            setTimeout(drawLines, 100);
        }

        function drawLines() {
            svgLayer.innerHTML = ''; 
            connections = [];
            svgLayer.style.width = container.scrollWidth + 'px';
            svgLayer.style.height = container.scrollHeight + 'px';

            Object.values(cardElements).forEach(source => {
                if(!source.data.nextSteps) return;
                source.data.nextSteps.forEach(targetId => {
                    const target = cardElements[targetId];
                    if(target) createPath(source, target);
                });
            });
        }

        function createPath(sourceObj, targetObj) {
            const sourceEl = sourceObj.element;
            const targetEl = targetObj.element;
            const containerRect = container.getBoundingClientRect();
            const sRect = sourceEl.getBoundingClientRect();
            const tRect = targetEl.getBoundingClientRect();

            const x1 = (sRect.right - containerRect.left);
            const y1 = (sRect.top - containerRect.top) + (sRect.height / 2);
            const x2 = (tRect.left - containerRect.left);
            const y2 = (tRect.top - containerRect.top) + (tRect.height / 2);
            
            const controlOffset = (x2 - x1) / 2;
            const pathData = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathData);
            path.setAttribute("class", "connector-path");
            svgLayer.appendChild(path);
            connections.push({ from: sourceObj.data.id, to: targetObj.data.id, element: path });
        }

        function selectRole(role) {
            detailsPanel.title.textContent = role.title;
            detailsPanel.level.textContent = role.dept;
            detailsPanel.desc.textContent = role.desc;
            if(role.req) {
                detailsPanel.req.textContent = role.req;
                detailsPanel.reqSection.style.display = "block";
            } else {
                detailsPanel.reqSection.style.display = "none";
            }

            document.querySelectorAll('.role-card').forEach(el => el.classList.remove('active', 'path-highlight'));
            document.querySelectorAll('.connector-path').forEach(el => {
                el.classList.remove('highlighted');
                el.classList.add('dimmed');
            });

            cardElements[role.id].element.classList.add('active');
            highlightForward(role.id);
        }

        function highlightForward(currentId) {
            const forwardConnections = connections.filter(c => c.from === currentId);
            forwardConnections.forEach(conn => {
                conn.element.classList.remove('dimmed');
                conn.element.classList.add('highlighted');
                if (cardElements[conn.to]) {
                    cardElements[conn.to].element.classList.add('path-highlight');
                    highlightForward(conn.to);
                }
            });
        }

        // Drag Scrolling
        const viewport = document.querySelector('.chart-viewport');
        viewport.addEventListener('mousedown', (e) => {
            chartState.isDown = true; chartState.isDragging = false;
            viewport.classList.add('active');
            chartState.startX = e.pageX - viewport.offsetLeft;
            chartState.startY = e.pageY - viewport.offsetTop;
            chartState.scrollLeft = viewport.scrollLeft;
            chartState.scrollTop = viewport.scrollTop;
        });
        viewport.addEventListener('mouseleave', () => { chartState.isDown = false; viewport.classList.remove('active'); });
        viewport.addEventListener('mouseup', () => {
            chartState.isDown = false; viewport.classList.remove('active');
            setTimeout(() => { chartState.isDragging = false; }, 50);
        });
        viewport.addEventListener('mousemove', (e) => {
            if (!chartState.isDown) return;
            e.preventDefault();
            const x = e.pageX - viewport.offsetLeft;
            const y = e.pageY - viewport.offsetTop;
            const walkX = (x - chartState.startX);
            const walkY = (y - chartState.startY);
            if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) chartState.isDragging = true;
            viewport.scrollLeft = chartState.scrollLeft - walkX;
            viewport.scrollTop = chartState.scrollTop - walkY;
        });

        window.addEventListener('resize', drawLines);
        window.onload = init; // Start app on load