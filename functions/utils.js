function updateFeatureStates({ source, sourceLayer, adminKey, originData}) {

    const features = map.querySourceFeatures(source, {
        sourceLayer
    });

    features.forEach((feature) => {
        const id = feature.id;
        let adminId = String(feature.properties[adminKey]);

        const data = originData[adminId];
        const density = Number(data?.["classe"]);
        const taux = Number(data?.["tx_evol_pop_2016-2022"])
        
        map.setFeatureState(
            {
                source,
                sourceLayer,
                id
            },
            {
                ["classe"]: density,
                ["tx_evol_pop_2016-2022"]: taux
            }
        );
    });
}

function updateCommuneCheckbox() {
    const infoCom = document.getElementById('toggle-com-info');
    const checkboxCom = document.getElementById('toggle-com');
    const communeLayer = map.getLayer('com');

    if (!communeLayer) return;

    const minZoom = communeLayer.minzoom ?? 0;
    const enabled = map.getZoom() >= minZoom;

    checkboxCom.disabled = !enabled;

    if (!enabled) {
        infoCom.title = `Zoomez pour afficher les communes`;
        infoCom.style.display = 'inline-flex';
    } else {
        infoCom.removeAttribute('title');
        infoCom.style.display = 'none';
    }

    if (!enabled && checkboxCom.checked) {
        checkboxCom.checked = false;
        map.setLayoutProperty(
            'com',
            'visibility',
            'none'
        );

        hideLegend();
    }
}

function updateLegend(type, data, colors) {

    const legend = document.getElementById('legend');

    if (!legend || !data) return;

    const classes = {};
    data.forEach(item => {
        const classe = Number(item.classe);
        if (!Number.isFinite(classe)) return;
        if (!(classe in classes)) {
            classes[classe] = item.classe_label;
        }
    });

    // Clean legend
    legend.innerHTML = `
        <div style="
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 12px;
        ">
            Taux d'évolution de la population<br>(2016-2022)
        </div>

        <div style="
            font-size: 11px;
            margin-bottom: 8px;
        ">
            Par ${type}
        </div>
    `;

    // Create element
    Object.keys(classes)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((classe, index) => {

            const color = colors[index];
            const label = classes[classe];

            const item = document.createElement('div');

            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.marginBottom = '5px';

            item.innerHTML = `
                <span style="
                    width: 18px;
                    height: 18px;
                    background: ${color};
                    display: inline-block;
                    margin-right: 8px;
                "></span>

                <span style="font-size: 11px"> ${label} %</span>
            `;

            legend.appendChild(item);
        });

        legend.style.display = 'block';
}

function hideLegend() {
    const legend = document.getElementById('legend');

    if (legend) {
        legend.style.display = 'none';
    }
}

let currentPopup = null;

function setupPopup(layerId, originData, adminType) {
    map.on('click', layerId, (e) => {

        // Ferme la popup précédente
        if (currentPopup) {
            currentPopup.remove();
        }

        const feature = e.features[0];
        
        if (adminType === 'dept' || adminType === 'reg') {
            code = String(feature.properties.code);
        }
        else {
            code = String(feature.properties.CdCommune)
        }

        const data = originData[code];
        const taux = data?.['tx_evol_pop_2016-2022'];

        currentPopup = new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>
                    ${feature.properties.nom ??  data?.['Libellé']}
                </strong><br>
                Taux d'évolution : ${taux ?? 'N/A'} %
            `)
            .addTo(map);
    });
}