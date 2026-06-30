const express = require('express');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = 5050;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
let listeEleves = [];

// ==========================================
// ROUTE 1 : IMPORTATION MULTI-FICHIERS
// ==========================================
app.post('/api/import', upload.array('files'), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "Aucun fichier fourni." });
        }

        listeEleves = [];
        let compteurFichiers = 0;

        req.files.forEach((file) => {
            let rows = [];
            if (file.originalname.endsWith('.csv')) {
                const contenuBrut = fs.readFileSync(file.path, { encoding: 'utf-8' });
                const lignesBrutes = contenuBrut.split(/\r?\n/);
                rows = lignesBrutes.map(l => l.split(';').map(c => c.replace(/^"|"$/g, '').trim()));
            } else {
                const workbook = XLSX.readFile(file.path, { codepage: 65001 });
                rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false });
            }

            rows = rows.filter(r => r && r.length > 0 && r[0] !== "");
            if (rows.length < 2) {
                fs.unlinkSync(file.path);
                return;
            }

            const entetes = rows[0].map(e => e ? String(e).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : "");
            
            let indexEleve = entetes.findIndex(e => e && (e.includes('eleve') || e.includes('nom')));
            let indexSexe = entetes.findIndex(e => e && e.includes('sexe'));
            let indexOpt1 = entetes.findIndex(e => e && e.includes('option 1'));
            let indexOpt2 = entetes.findIndex(e => e && e.includes('option 2'));
            let indexOpt3 = entetes.findIndex(e => e && e.includes('option 3'));
            let indexRegime = entetes.findIndex(e => e && e.includes('regime'));

            const realIndexEleve = indexEleve !== -1 ? indexEleve : 0;
            const realIndexSexe = indexSexe !== -1 ? indexSexe : 1;

            for (let i = 1; i < rows.length; i++) {
                const ligne = rows[i];
                if (!ligne || !ligne[realIndexEleve]) continue;

                const nomCompletBrut = String(ligne[realIndexEleve]).trim();
                if (nomCompletBrut.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'eleves' || nomCompletBrut === "") continue;

                const existeDeja = listeEleves.some(el => el.nomComplet.toLowerCase() === nomCompletBrut.toLowerCase());
                if (existeDeja) continue;

                const morceaux = nomCompletBrut.split(" ");
                const sexeBrut = ligne[realIndexSexe] ? String(ligne[realIndexSexe]).toLowerCase().trim() : "";

                const options = [];
                if (indexOpt1 !== -1 && ligne[indexOpt1]) options.push(String(ligne[indexOpt1]).trim());
                if (indexOpt2 !== -1 && ligne[indexOpt2]) options.push(String(ligne[indexOpt2]).trim());
                if (indexOpt3 !== -1 && ligne[indexOpt3]) options.push(String(ligne[indexOpt3]).trim());

                listeEleves.push({
                    id: `eleve-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    nom: morceaux[0] || "NOM",
                    prenom: morceaux.slice(1).join(" ") || "Prénom",
                    nomComplet: nomCompletBrut,
                    sexe: (sexeBrut.startsWith('f') || sexeBrut.includes('fem')) ? 'F' : 'M',
                    options: options,
                    regime: indexRegime !== -1 && ligne[indexRegime] ? String(ligne[indexRegime]).trim() : "EXTERNE",
                    niveau: "Moyen",
                    comportement: "Calme",
                    ULIS: false,
                    bloquerAvec: [],
                    separerDe: []
                });
            }

            compteurFichiers++;
            fs.unlinkSync(file.path);
        });

        res.json({ 
            message: `Importation réussie : ${compteurFichiers} fichiers cumulés.`, 
            donnees: listeEleves 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors du traitement." });
    }
});

// ==========================================
// ROUTE 2 : MOTEUR AVEC CONTRAINTES COMPLÈTES
// ==========================================
app.post('/api/generer-classes', (req, res) => {
    try {
        const { typologieClasses, listeElevesConfigurees } = req.body; 

        if (!typologieClasses || typologieClasses.length === 0) {
            return res.status(400).json({ error: "Aucune structure de classe définie." });
        }

        if (listeElevesConfigurees && listeElevesConfigurees.length > 0) {
            listeEleves = listeElevesConfigurees;
        }

        if (listeEleves.length === 0) return res.status(400).json({ error: "Aucun élève en mémoire." });

        const classes = {};
        const typesParClasse = {}; 

        let compteurs = { italien: 1, espagnol: 1, mixte: 1 };
        typologieClasses.forEach((type) => {
            let label = "";
            if (type === "italien") label = `Classe Italien ${compteurs.italien++}`;
            else if (type === "espagnol") label = `Classe Espagnol ${compteurs.espagnol++}`;
            else label = `Classe Mixte ${compteurs.mixte++}`;

            classes[label] = [];
            typesParClasse[label] = type;
        });

        let elevesRestants = listeEleves.map(e => ({
            ...e,
            options: e.options || [],
            bloquerAvec: e.bloquerAvec || [],
            separerDe: e.separerDe || [],
            niveau: e.niveau || "Moyen",
            comportement: e.comportement || "Calme",
            ULIS: e.ULIS || false
        }));

        const obtenirMeilleureClasse = (eleve, classesActuelles) => {
            let meilleureClasse = Object.keys(classesActuelles)[0];
            let scoreMinimum = Infinity;

            const optionsChaine = eleve.options.join(' ').toLowerCase();
            const estItalien = optionsChaine.includes('ital');
            const estEspagnol = optionsChaine.includes('esp');
            // "Voile" est un critère affiché/pris en compte mais ne déclenche pas de classes dédiées
            const estVoile = optionsChaine.includes('voile');

            Object.keys(classesActuelles).forEach((nomClasse) => {
                const classe = classesActuelles[nomClasse];
                const typeDeLaClasse = typesParClasse[nomClasse];
                
                let scoreIncompatibilite = classe.length * 10;

                // --- STRATÉGIE DES LANGUES ---
                if (typeDeLaClasse === 'italien') {
                    if (estItalien) scoreIncompatibilite -= 1500;  
                    if (estEspagnol) scoreIncompatibilite += 8000; 
                } 
                else if (typeDeLaClasse === 'espagnol') {
                    if (estEspagnol) scoreIncompatibilite -= 1500; 
                    if (estItalien) scoreIncompatibilite += 8000;  
                } 
                else if (typeDeLaClasse === 'mixte') {
                    if (estItalien || estEspagnol) {
                        const aOptionsCommunes = classe.some(e => 
                            e.options.some(opt => eleve.options.includes(opt))
                        );
                        if (aOptionsCommunes) scoreIncompatibilite -= 15;
                    }
                }

                // Sexe & Niveaux
                const nbSexe = classe.filter(e => e.sexe === eleve.sexe).length;
                scoreIncompatibilite += nbSexe * 5;

                const nbNiveau = classe.filter(e => e.niveau === eleve.niveau).length;
                scoreIncompatibilite += nbNiveau * 3;

                // --- COMPORTEMENT : étaler les perturbateurs entre les classes ---
                if (eleve.comportement === 'Perturbateur') {
                    const nbPerturbateurs = classe.filter(e => e.comportement === 'Perturbateur').length;
                    // Pénalité croissante : plus une classe a déjà de perturbateurs,
                    // moins elle est intéressante pour en accueillir un de plus.
                    scoreIncompatibilite += nbPerturbateurs * 600;
                }

                // --- RETOUR DES CONTRAINTES SOCIALES (AMIS / BAVARDS) ---
                const contientUnBavard = classe.some(e => eleve.separerDe.includes(e.id) || e.separerDe.includes(eleve.id));
                if (contientUnBavard) scoreIncompatibilite += 4000; // Forte pénalité pour séparer les bavards/conflits

                const contientUnAmi = classe.some(e => eleve.bloquerAvec.includes(e.id) || e.bloquerAvec.includes(eleve.id));
                if (contientUnAmi) scoreIncompatibilite -= 2000; // Gros bonus pour regrouper les binômes désirés

                if (scoreIncompatibilite < scoreMinimum) {
                    scoreMinimum = scoreIncompatibilite;
                    meilleureClasse = nomClasse;
                }
            });

            return meilleureClasse;
        };

        const ordreNiveaux = { "En difficulté": 4, "Moyen": 3, "Bon": 2, "Très Bon": 1 };
        elevesRestants.sort((a, b) => {
            if (a.ULIS !== b.ULIS) return b.ULIS - a.ULIS;
            
            // Priorité de placement à ceux qui ont des blocages d'amis ou de langues
            const contrainteA = a.bloquerAvec.length > 0 || a.separerDe.length > 0;
            const contrainteB = b.bloquerAvec.length > 0 || b.separerDe.length > 0;
            if (contrainteA !== contrainteB) return contrainteB - contrainteA;

            // Les profils perturbateurs sont placés tôt pour que la pénalité
            // de concentration agisse efficacement sur les suivants
            if (a.comportement !== b.comportement) {
                return (b.comportement === 'Perturbateur' ? 1 : 0) - (a.comportement === 'Perturbateur' ? 1 : 0);
            }

            const optA = a.options.join(' ').toLowerCase().includes('ital') || a.options.join(' ').toLowerCase().includes('esp');
            const optB = b.options.join(' ').toLowerCase().includes('ital') || b.options.join(' ').toLowerCase().includes('esp');
            if (optA !== optB) return optB - optA;

            if (a.niveau !== b.niveau) return ordreNiveaux[b.niveau] - ordreNiveaux[a.niveau];
            return a.options.join(',').localeCompare(b.options.join(','));
        });

        elevesRestants.forEach(eleve => {
            const cible = obtenirMeilleureClasse(eleve, classes);
            classes[cible].push(eleve);
        });

        res.json({ classes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la génération." });
    }
});

// ==========================================
// EXPORTS XLSX
// ==========================================
app.post('/api/export', (req, res) => {
    try {
        const { classes } = req.body;
        const workbook = XLSX.utils.book_new();
        Object.keys(classes).forEach((nomClasse) => {
            const worksheet = XLSX.utils.json_to_sheet(classes[nomClasse].map(e => ({
                "Nom Complet": e.nomComplet, "Sexe": e.sexe, "Options": e.options.join(', '), "Niveau": e.niveau, "Comportement": e.comportement || "Calme", "ULIS": e.ULIS ? "Oui" : "Non", "Régime": e.regime
            })));
            XLSX.utils.book_append_sheet(workbook, worksheet, nomClasse.substring(0, 30));
        });
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Classes.xlsx');
        res.send(buffer);
    } catch (e) { res.status(500).send(e); }
});

app.post('/api/export-classe-specifique', (req, res) => {
    try {
        const { nomClasse, listeElevesClasse } = req.body;
        const worksheet = XLSX.utils.json_to_sheet(listeElevesClasse.map(e => ({
            "Classe attribuée": nomClasse, "Nom Complet": e.nomComplet, "Sexe": e.sexe, "Options": e.options.join(', '), "Régime": e.regime
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pronote");
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (e) { res.status(500).send(e); }
});

app.listen(PORT, () => console.log(`🚀 Backend lancé sur http://localhost:${PORT}`));