import { useState } from 'react';
import { Flag, Music, Scale, Upload, Download, FileDown, Accessibility, GripVertical } from 'lucide-react';

// ---------------------------------------------------------------------------
// Design tokens — "classeur de salle des profs"
// ---------------------------------------------------------------------------
const C = {
  ink: '#16213E',        // bleu nuit encre — titres, texte fort
  paper: '#FAF6EE',      // papier ivoire — fond général
  card: '#FFFFFF',       // fiche blanche
  manila: '#E8E2D4',     // carton manille — fonds de section
  chalk: '#5B8C5A',      // vert craie tableau — accent principal / succès
  postit: '#D4A03C',     // jaune post-it / craie — accent secondaire
  red: '#C44536',        // rouge correction — alerte / ULIS
  pink: '#C2538B',       // rose — filles
  blue: '#2D6CA3',       // bleu stylo — garçons
  line: '#D8D0BC',       // ligne de cahier
  muted: '#6B6456',
};

const fontDisplay = "'Space Grotesk', 'Arial Narrow', sans-serif";
const fontBody = "'Source Sans 3', 'Segoe UI', sans-serif";
const fontMono = "'JetBrains Mono', 'Courier New', monospace";

function App() {
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [eleves, setEleves] = useState([]);

  const [nbItalien, setNbItalien] = useState(1);
  const [nbEspagnol, setNbEspagnol] = useState(1);
  const [nbMixte, setNbMixte] = useState(2);

  const [classesGenerees, setClassesGenerees] = useState({});
  const [dragOverClasse, setDragOverClasse] = useState(null);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Sélectionne au moins un fichier !");
      return;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await fetch('http://localhost:5050/api/import', { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) {
        setMessage(`${data.message} ${data.donnees ? data.donnees.length : 0} élèves chargés.`);
        setFiles([]);
        setEleves((data.donnees || []).map(e => ({
          ...e, niveau: "Moyen", ULIS: false, bloquerAvec: [], separerDe: []
        })));
        setClassesGenerees({});
      } else { setMessage("Erreur : " + data.error); }
    } catch (error) { setMessage("Erreur serveur."); }
  };

  const modifierCritereEleve = (id, cle, valeur) => {
    setEleves(eleves.map(e => e.id === id ? { ...e, [cle]: valeur } : e));
  };

  const handleRepartir = async () => {
    if (eleves.length === 0) return alert("Pas d'élèves chargés.");

    const typologieClasses = [
      ...Array(Math.max(0, nbItalien)).fill('italien'),
      ...Array(Math.max(0, nbEspagnol)).fill('espagnol'),
      ...Array(Math.max(0, nbMixte)).fill('mixte')
    ];

    if (typologieClasses.length === 0) {
      alert("Veuillez configurer au moins 1 classe à générer !");
      return;
    }

    try {
      const response = await fetch('http://localhost:5050/api/generer-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typologieClasses: typologieClasses,
          listeElevesConfigurees: eleves
        })
      });
      const data = await response.json();
      if (response.ok) {
        setClassesGenerees(data.classes);
      } else { alert(data.error); }
    } catch (e) { alert("Erreur serveur."); }
  };

  const renommerClasse = (ancienNom, nouveauNom) => {
    if (!nouveauNom || nouveauNom.trim() === "") return;
    setClassesGenerees(prev => {
      const copy = {};
      Object.keys(prev).forEach(k => { copy[k === ancienNom ? nouveauNom : k] = prev[k]; });
      return copy;
    });
  };

  const handleExportGlobal = async () => {
    try {
      const response = await fetch('http://localhost:5050/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classes: classesGenerees })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Classes_Equilibrees.xlsx'; a.click();
    } catch (e) { alert("Erreur export."); }
  };

  const handleExportClasseUnique = async (nomClasse, listeElevesClasse) => {
    try {
      const response = await fetch('http://localhost:5050/api/export-classe-specifique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomClasse, listeElevesClasse })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Export_${nomClasse}.xlsx`; a.click();
    } catch (e) { alert("Erreur."); }
  };

  const handleDragStart = (e, eleveId, classeOrigine) => {
    e.dataTransfer.setData("eleveId", eleveId);
    e.dataTransfer.setData("classeOrigine", classeOrigine);
  };
  const handleDragOver = (e, nomClasse) => {
    e.preventDefault();
    setDragOverClasse(nomClasse);
  };
  const handleDragLeave = () => setDragOverClasse(null);
  const handleDrop = (e, classeDestination) => {
    e.preventDefault();
    setDragOverClasse(null);
    const eleveId = e.dataTransfer.getData("eleveId");
    const classeOrigine = e.dataTransfer.getData("classeOrigine");
    if (classeOrigine === classeDestination) return;

    setClassesGenerees(prev => {
      const copy = { ...prev };
      const idx = copy[classeOrigine].findIndex(el => el.id === eleveId);
      if (idx !== -1) {
        const [eleve] = copy[classeOrigine].splice(idx, 1);
        copy[classeDestination].push(eleve);
      }
      return copy;
    });
  };

  // -------------------------------------------------------------------------
  // Sous-composants visuels
  // -------------------------------------------------------------------------

  const Tab = ({ num, label, active }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      opacity: active ? 1 : 0.35,
    }}>
      <span style={{
        fontFamily: fontMono, fontWeight: 700, fontSize: '0.85em',
        color: active ? C.chalk : C.muted,
      }}>{num}</span>
      <span style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: '0.92em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );

  const Stepper = ({ value, onChange, icon, label, accent }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '8px 4px', flex: '1 1 220px',
    }}>
      <div style={{ color: accent, flexShrink: 0, opacity: 0.85 }}>{icon}</div>
      <span style={{ fontFamily: fontBody, fontWeight: 600, fontSize: '0.88em', color: C.ink, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Diminuer ${label}`}
          style={stepBtnStyle}
        >−</button>
        <span style={{
          fontFamily: fontMono, fontWeight: 700, fontSize: '1.05em',
          minWidth: '28px', textAlign: 'center', color: C.ink,
        }}>{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Augmenter ${label}`}
          style={stepBtnStyle}
        >+</button>
      </div>
    </div>
  );

  const stepBtnStyle = {
    width: '24px', height: '24px', fontSize: '1em', fontWeight: 700,
    cursor: 'pointer', border: 'none', backgroundColor: 'transparent',
    borderRadius: '4px', color: C.muted, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: C.paper, fontFamily: fontBody, color: C.ink,
    }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${C.postit}; color: ${C.ink}; }
        button:focus-visible, input:focus-visible, select:focus-visible {
          outline: 2px solid ${C.blue}; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }

        .cc-container { padding: 36px 28px 60px; }
        .cc-header { margin-bottom: 32px; }
        .cc-tabs { margin-left: auto; }
        .cc-section { padding: 22px 24px; }
        .cc-upload-row { flex-wrap: wrap; }
        .cc-upload-btn { margin-left: auto; }
        .cc-table-wrap { overflow-x: auto; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .cc-structure-row { flex-wrap: wrap; }
        .cc-structure-total { margin-left: auto; }
        .cc-step3-head { flex-wrap: wrap; }
        .cc-classes-row { overflow-x: auto; }
        .cc-class-card { min-width: 300px; }

        @media (max-width: 760px) {
          .cc-container { padding: 20px 14px 40px; }
          .cc-header { flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 22px; }
          .cc-tabs { margin-left: 0; gap: 18px !important; }
          .cc-section { padding: 16px; }
          .cc-section h3 { font-size: 0.98em !important; }
          .cc-upload-row { flex-direction: column; align-items: stretch !important; }
          .cc-upload-btn { margin-left: 0 !important; width: 100%; justify-content: center; }
          .cc-upload-row label { justify-content: center; }
          .cc-structure-row { gap: 4px !important; }
          .cc-structure-total { margin-left: 0 !important; width: 100%; justify-content: space-between; padding: 10px 4px !important; border-top: 1px solid ${C.line}; margin-top: 4px; }
          .cc-step3-head { flex-direction: column; align-items: stretch !important; }
          .cc-step3-head button { width: 100%; justify-content: center; }
          .cc-class-card { min-width: 78vw; }
        }

        @media (max-width: 480px) {
          .cc-class-card { min-width: 86vw; }
        }
      `}</style>

      <div className="cc-container" style={{ maxWidth: '1320px', margin: '0 auto' }}>

        {/* ENTÊTE — étiquette de classeur */}
        <header className="cc-header" style={{ display: 'flex', alignItems: 'baseline', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{
            color: C.ink,
            fontFamily: fontDisplay, fontWeight: 700, fontSize: '1.5em',
            letterSpacing: '-0.01em',
          }}>
            Consti-Classe
          </div>
          <span style={{ fontFamily: fontMono, fontSize: '0.85em', color: C.muted, letterSpacing: '0.03em' }}>
            répartition d'élèves — niveau en cours
          </span>

          {/* Onglets de progression */}
          <div className="cc-tabs" style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            <Tab num="1" label="Import" active={true} />
            <Tab num="2" label="Critères" active={eleves.length > 0} />
            <Tab num="3" label="Classes" active={Object.keys(classesGenerees).length > 0} />
          </div>
        </header>

        {/* ÉTAPE 1 — Import */}
        <section className="cc-section" style={{
          marginBottom: '24px',
          backgroundColor: C.card, border: `1px solid ${C.line}`, borderRadius: '8px',
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.05em' }}>
            Étape 1 — Importer les fichiers Pronote
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.85em', color: C.muted }}>
            Sélection multiple acceptée : les fichiers du niveau sont fusionnés automatiquement.
          </p>
          <div className="cc-upload-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '9px 16px', backgroundColor: 'transparent', border: `1px solid ${C.line}`,
              borderRadius: '5px', cursor: 'pointer', fontSize: '0.88em', fontWeight: 600,
            }}>
              <Upload size={16} strokeWidth={2.2} />
              Choisir des fichiers
              <input type="file" accept=".xlsx, .xls, .csv" multiple onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
            <span style={{ fontFamily: fontMono, fontSize: '0.82em', color: C.muted }}>
              {files.length > 0 ? `${files.length} fichier(s) sélectionné(s)` : 'aucun fichier sélectionné'}
            </span>
            <button className="cc-upload-btn" onClick={handleUpload} style={{
              padding: '10px 20px', backgroundColor: C.ink, color: C.paper,
              border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 700,
              fontFamily: fontDisplay, fontSize: '0.88em', letterSpacing: '0.01em',
            }}>
              Charger et fusionner
            </button>
          </div>
          {message && (
            <p style={{
              marginTop: '14px', marginBottom: 0, fontWeight: 600, fontSize: '0.88em',
              color: C.chalk, display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              ✓ {message}
            </p>
          )}
        </section>

        {/* ÉTAPE 2 — Configuration */}
        {eleves.length > 0 && (
          <section className="cc-section" style={{
            marginBottom: '24px',
            backgroundColor: C.card, border: `1px solid ${C.line}`, borderRadius: '8px',
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.05em' }}>
              Étape 2 — Critères et affinités par élève
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85em', color: C.muted }}>
              {eleves.length} élève(s) chargé(s). Ajustez le niveau, les liaisons ULIS, et les liens à respecter ou éviter.
            </p>

            <div className="cc-table-wrap" style={{
              maxHeight: '320px', border: `1px solid ${C.line}`, borderRadius: '6px',
              marginBottom: '24px',
            }}>
              <table className="cc-table" style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                <thead style={{ backgroundColor: C.manila, position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {['Élève', 'Options', 'Niveau scolaire', 'ULIS', 'Bloquer avec', 'Séparer de'].map((h, i) => (
                      <th key={h} style={{
                        padding: '8px 10px', textAlign: i === 3 ? 'center' : 'left',
                        fontFamily: fontDisplay, fontWeight: 600, fontSize: '0.8em',
                        color: C.ink, borderBottom: `1px solid ${C.line}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eleves.map((e, idx) => (
                    <tr key={e.id} style={{
                      borderBottom: `1px solid ${C.line}`,
                    }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: fontBody }}>{e.nomComplet}</td>
                      <td style={{ padding: '8px 10px', color: C.blue, fontStyle: 'italic', fontSize: '0.95em' }}>
                        {e.options.join(', ') || '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select value={e.niveau} onChange={(opt) => modifierCritereEleve(e.id, 'niveau', opt.target.value)} style={selectStyle}>
                          <option value="Très Bon">★ Très bon</option>
                          <option value="Bon">● Bon</option>
                          <option value="Moyen">▲ Moyen</option>
                          <option value="En difficulté">■ En difficulté</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox" checked={e.ULIS}
                          onChange={(chk) => modifierCritereEleve(e.id, 'ULIS', chk.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: C.red, cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={e.bloquerAvec[0] || ""}
                          onChange={(opt) => modifierCritereEleve(e.id, 'bloquerAvec', opt.target.value ? [opt.target.value] : [])}
                          style={{ ...selectStyle, borderLeft: `2px solid ${C.chalk}` }}
                        >
                          <option value="">— aucun —</option>
                          {eleves.filter(el => el.id !== e.id).map(el => <option key={el.id} value={el.id}>{el.nomComplet}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <select
                          value={e.separerDe[0] || ""}
                          onChange={(opt) => modifierCritereEleve(e.id, 'separerDe', opt.target.value ? [opt.target.value] : [])}
                          style={{ ...selectStyle, borderLeft: `2px solid ${C.red}` }}
                        >
                          <option value="">— aucun —</option>
                          {eleves.filter(el => el.id !== e.id).map(el => <option key={el.id} value={el.id}>{el.nomComplet}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Structure des classes */}
            <div style={{
              backgroundColor: C.manila, padding: '16px 18px', borderRadius: '6px',
              marginBottom: '20px',
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontFamily: fontDisplay, fontWeight: 600, fontSize: '0.9em', color: C.ink }}>
                Structure du niveau à constituer
              </h4>
              <div className="cc-structure-row" style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <Stepper value={nbItalien} onChange={setNbItalien} icon={<Flag size={18} strokeWidth={2} />} label="Pure italien" accent={C.chalk} />
                <Stepper value={nbEspagnol} onChange={setNbEspagnol} icon={<Music size={18} strokeWidth={2} />} label="Pure espagnol" accent={C.postit} />
                <Stepper value={nbMixte} onChange={setNbMixte} icon={<Scale size={18} strokeWidth={2} />} label="Mixtes" accent={C.blue} />
                <div className="cc-structure-total" style={{
                  display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px',
                  padding: '8px 14px',
                }}>
                  <span style={{ fontSize: '0.78em', color: C.muted, fontFamily: fontBody }}>Total</span>
                  <span style={{ fontFamily: fontMono, fontWeight: 700, fontSize: '1.2em', color: C.ink }}>{nbItalien + nbEspagnol + nbMixte}</span>
                </div>
              </div>
            </div>

            <button onClick={handleRepartir} style={{
              padding: '12px 25px', backgroundColor: C.chalk, color: C.paper,
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontFamily: fontDisplay, fontWeight: 700, fontSize: '0.95em',
              width: '100%',
            }}>
              Lancer la constitution des classes
            </button>
          </section>
        )}

        {/* ÉTAPE 3 — Résultat */}
        {Object.keys(classesGenerees).length > 0 && (
          <section>
            <div className="cc-step3-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px', gap: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: fontDisplay, fontWeight: 600, fontSize: '1.1em' }}>
                Étape 3 — Ajustements et visualisation
              </h3>
              <button onClick={handleExportGlobal} style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', backgroundColor: C.ink, color: C.paper,
                border: 'none', borderRadius: '5px', fontWeight: 700, cursor: 'pointer',
                fontFamily: fontDisplay, fontSize: '0.85em',
              }}>
                <Download size={16} strokeWidth={2.2} />
                Télécharger l'Excel complet
              </button>
            </div>

            <div className="cc-classes-row" style={{ display: 'flex', gap: '18px', paddingBottom: '24px' }}>
              {Object.keys(classesGenerees).map((nomClasse) => {
                const liste = classesGenerees[nomClasse];
                const filles = liste.filter(e => e.sexe === 'F').length;
                const garcons = liste.filter(e => e.sexe === 'M').length;
                const nbUlis = liste.filter(e => e.ULIS === true || e.ULIS === "true").length;
                const isOver = dragOverClasse === nomClasse;

                return (
                  <div
                    key={nomClasse}
                    className="cc-class-card"
                    onDragOver={(e) => handleDragOver(e, nomClasse)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, nomClasse)}
                    style={{
                      flex: '1', borderRadius: '8px',
                      backgroundColor: isOver ? '#FFF9EC' : C.card,
                      border: `1px solid ${isOver ? C.postit : C.line}`,
                      padding: '16px', position: 'relative',
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                  >

                    <div style={{ marginBottom: '6px' }}>
                      <input
                        type="text" defaultValue={nomClasse}
                        onBlur={(e) => renommerClasse(nomClasse, e.target.value)}
                        style={{
                          width: '100%', padding: '7px 10px', fontSize: '1.05em',
                          fontFamily: fontDisplay, fontWeight: 700, border: `1px solid ${C.line}`,
                          borderRadius: '5px', backgroundColor: C.paper, textAlign: 'center', color: C.ink,
                        }}
                      />
                      <div style={{
                        fontFamily: fontMono, fontSize: '0.75em', color: C.muted,
                        textAlign: 'center', marginTop: '4px',
                      }}>{liste.length} élèves</div>
                    </div>

                    <button onClick={() => handleExportClasseUnique(nomClasse, liste)} style={{
                      width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '7px', backgroundColor: 'transparent', color: C.muted, border: `1px solid ${C.line}`,
                      borderRadius: '5px', fontSize: '0.78em', fontWeight: 600, cursor: 'pointer', marginBottom: '12px',
                      fontFamily: fontBody,
                    }}>
                      <FileDown size={14} strokeWidth={2.2} />
                      Exporter cette classe
                    </button>

                    <div style={{
                      display: 'flex', gap: '12px', fontFamily: fontMono, fontSize: '0.78em',
                      color: C.ink, marginBottom: '10px',
                      padding: '0 2px', alignItems: 'center', flexWrap: 'wrap',
                    }}>
                      <span style={{ color: C.pink, fontWeight: 700 }}>F:{filles}</span>
                      <span style={{ color: C.blue, fontWeight: 700 }}>G:{garcons}</span>
                      {nbUlis > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: C.red, fontWeight: 700, marginLeft: 'auto' }}>
                          <Accessibility size={13} /> {nbUlis}
                        </span>
                      )}
                    </div>

                    <div style={{
                      minHeight: '340px', maxHeight: '480px', overflowY: 'auto',
                      padding: '2px',
                    }}>
                      {liste.map((eleve) => (
                        <div
                          key={eleve.id} draggable
                          onDragStart={(e) => handleDragStart(e, eleve.id, nomClasse)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '6px',
                            padding: '7px 8px', marginBottom: '4px', backgroundColor: 'transparent',
                            border: 'none', borderBottom: `1px solid ${C.line}`,
                            borderLeft: `2px solid ${eleve.sexe === 'F' ? C.pink : C.blue}`,
                            borderRadius: '0', fontSize: '0.86em', cursor: 'grab',
                          }}
                        >
                          <GripVertical size={13} color={C.muted} style={{ marginTop: '2px', flexShrink: 0, opacity: 0.5 }} />
                          <div>
                            <strong style={{ fontFamily: fontBody }}>{eleve.nomComplet}</strong>
                            {eleve.options?.length > 0 && (
                              <div style={{ fontSize: '0.74em', color: C.blue, marginTop: '2px', fontWeight: 600 }}>
                                {eleve.options.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '5px 6px', fontSize: '0.95em', fontFamily: "'Source Sans 3', sans-serif",
  border: '1px solid transparent', borderBottom: '1px solid #D8D0BC', borderRadius: '0', backgroundColor: 'transparent', color: '#16213E',
};

export default App;
