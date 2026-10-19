const API_URL = 'https://sheetdb.io/api/v1/46gzx2zgab6ug'; 
const TELEFONO_WSP = '5492284600624'; 

let todosLosProductos = [];
let slideIndex = 0;
let timerSlider;

// 1. Procesamiento de URLs de Google Drive
function procesarImagenDrive(texto) {
  if (!texto) return 'https://via.placeholder.com/300x250';
  let limpio = String(texto).trim();
  if (!limpio) return 'https://via.placeholder.com/300x250';

  if (limpio.includes('drive.google.com')) {
    const match = limpio.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) limpio = match[1];
  }

  if (!limpio.startsWith('http')) {
    return `https://lh3.googleusercontent.com/d/${limpio}`;
  }
  return limpio;
}

// 2. Carga inicial de datos
fetch(API_URL)
  .then(response => {
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    return response.json();
  })
  .then(productos => {
    let lista = productos;
    if (productos && typeof productos === 'object' && !Array.isArray(productos)) {
      lista = Object.values(productos)[0] || [];
    }

    // AQUÍ APLICAMOS EL ORDEN: Primero los "nuevo", el resto mezclados
    todosLosProductos = ordenarNuevosPrimeros(Array.isArray(lista) ? lista : []);

    poblarCategorias(todosLosProductos);
    renderizarTodo(todosLosProductos);
    configurarEventosModal();
    iniciarSlider();
  })
  .catch(error => {
    console.error('Error cargando catálogo:', error);
    const catalogo = document.getElementById('catalogo');
    if (catalogo) catalogo.innerHTML = '<p>Error al cargar los productos. Por favor reintente más tarde.</p>';
  });

// 3. Renderizado principal
function renderizarTodo(productos) {
  const catalogoGral = document.getElementById('catalogo');
  const catalogoDestacados = document.getElementById('catalogo-destacados');
  const seccionDestacados = document.getElementById('seccion-destacados');
  const contador = document.getElementById('contador-resultados');

  catalogoGral.innerHTML = '';
  catalogoDestacados.innerHTML = '';

  if (!Array.isArray(productos) || productos.length === 0) {
    catalogoGral.innerHTML = '<p>No se encontraron productos que coincidan.</p>';
    if (seccionDestacados) seccionDestacados.style.display = 'none';
    if (contador) contador.textContent = '0 productos encontrados';
    return;
  }

  if (contador) contador.textContent = `${productos.length} producto(s) encontrado(s)`;

  // Filtrar destacados por la columna 'destacado' === 'si'
  const listaDestacados = productos.filter(p => p.destacado && String(p.destacado).trim().toLowerCase() === 'si');

  if (listaDestacados.length > 0 && seccionDestacados) {
    seccionDestacados.style.display = 'block';
    listaDestacados.forEach(prod => {
      catalogoDestacados.innerHTML += crearTarjetaHTML(prod);
    });
  } else if (seccionDestacados) {
    seccionDestacados.style.display = 'none';
  }

  // Renderizar catálogo general
  productos.forEach(prod => {
    catalogoGral.innerHTML += crearTarjetaHTML(prod);
  });
}

// 4. Generación de tarjeta HTML
function crearTarjetaHTML(prod) {
  const id = prod.id || Math.random().toString(36).substr(2, 9);
  const nombre = prod.nombre || 'Producto sin nombre';
  const categoria = prod.categoria || '';
  const descripcion = prod.descripcion || '';
  const badge = prod.badge || '';

  const fotosRaw = prod.imagenes ? String(prod.imagenes).split(',') : [];
  const fotos = fotosRaw.length > 0 && fotosRaw[0].trim() !== "" 
    ? fotosRaw.map(url => procesarImagenDrive(url)) 
    : ['https://via.placeholder.com/300x250'];

  const fotoPrincipal = fotos[0];
  const badgeHTML = badge ? `<span class="badge">${badge}</span>` : '';

  let galleryHTML = '';
  if (fotos.length > 1) {
    galleryHTML = `<div class="product-thumbs">`;
    fotos.forEach(fotoUrl => {
      galleryHTML += `<img src="${fotoUrl}" onclick="event.stopPropagation(); document.getElementById('img-${id}').src='${fotoUrl}'" class="thumb">`;
    });
    galleryHTML += `</div>`;
  }

  return `
    <article class="product-card" onclick="abrirModalProducto('${id}', event)">
      <div class="product-image">
        <img id="img-${id}" src="${fotoPrincipal}" alt="${nombre}">
        ${badgeHTML}
      </div>

      ${galleryHTML}

      <div class="product-content">
        <span class="product-category">${categoria}</span>
        <h3 class="product-title">${nombre}</h3>
        <p class="product-description">${descripcion}</p>

        <div class="product-footer">
          <button class="btn-add-cart" onclick="enviarWhatsAppSimple('${id}', '${nombre.replace(/'/g, "\\'")}', event)">
            Consultar por whatsapp
          </button>
        </div>
      </div>
    </article>
  `;
}

// 5. Lógica del Desplegable de Categorías
function poblarCategorias(productos) {
  const dropdown = document.getElementById('categorias-dropdown');
  const selectCat = document.getElementById('select-categoria');

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];

  categorias.forEach(cat => {
    const itemMenu = document.createElement('a');
    itemMenu.href = '#productos-seccion';
    itemMenu.textContent = cat;
    itemMenu.onclick = () => filtrarPorCategoria(cat);
    dropdown.appendChild(itemMenu);

    const itemSelect = document.createElement('option');
    itemSelect.value = cat;
    itemSelect.textContent = cat;
    selectCat.appendChild(itemSelect);
  });
}

// Función auxiliar para quitar acentos/tildes a un texto
function quitarAcentos(texto) {
  if (!texto) return '';
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// 6. Búsqueda y Filtros
function filtrarProductos() {
  const textoInput = document.getElementById('input-busqueda').value;
  const textoBuscado = quitarAcentos(textoInput);
  const categoria = document.getElementById('select-categoria').value;

  const filtrados = todosLosProductos.filter(prod => {
    const nombreNormalizado = quitarAcentos(prod.nombre);
    const descNormalizada = quitarAcentos(prod.descripcion);

    const coincideNombre = nombreNormalizado.includes(textoBuscado);
    const coincideDesc = descNormalizada.includes(textoBuscado);
    const coincideTexto = coincideNombre || coincideDesc;

    const coincideCategoria = categoria === '' || (prod.categoria && prod.categoria === categoria);

    return coincideTexto && coincideCategoria;
  });

  renderizarTodo(filtrados);
}

function filtrarPorCategoria(cat) {
  document.getElementById('select-categoria').value = cat;
  filtrarProductos();
}

function filtrarDestacados() {
  const destacados = todosLosProductos.filter(p => p.destacado && String(p.destacado).trim().toLowerCase() === 'si');
  renderizarTodo(destacados);
}

function limpiarFiltros() {
  document.getElementById('input-busqueda').value = '';
  document.getElementById('select-categoria').value = '';
  renderizarTodo(todosLosProductos);
}

// 7. Modal Expandido
function abrirModalProducto(id, event) {
  if (event && (event.target.tagName === 'BUTTON' || event.target.tagName === 'SELECT' || event.target.tagName === 'A' || event.target.classList.contains('thumb'))) {
    return;
  }

  const prod = todosLosProductos.find(p => String(p.id) === String(id));
  if (!prod) return;

  const fotosRaw = prod.imagenes ? String(prod.imagenes).split(',') : [];
  const fotos = fotosRaw.length > 0 && fotosRaw[0].trim() !== "" 
    ? fotosRaw.map(url => procesarImagenDrive(url)) 
    : ['https://via.placeholder.com/300x250'];

  const listaColores = prod.colores ? String(prod.colores).split(',').map(c => c.trim()).filter(Boolean) : [];
  const listaMedidas = prod.medidas ? String(prod.medidas).split(',').map(m => m.trim()).filter(Boolean) : [];

  let opcionesHTML = '';
  if (listaColores.length > 0) {
    opcionesHTML += `
      <div class="product-option">
        <label><b>Color:</b></label>
        <select id="modal-color-${prod.id}">
          ${listaColores.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>`;
  }

  if (listaMedidas.length > 0) {
    opcionesHTML += `
      <div class="product-option">
        <label><b>Medida:</b></label>
        <select id="modal-medida-${prod.id}">
          ${listaMedidas.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>`;
  }

  let galleryHTML = '';
  if (fotos.length > 1) {
    galleryHTML = `<div class="product-thumbs" style="margin-top:10px;">`;
    fotos.forEach(fotoUrl => {
      galleryHTML += `<img src="${fotoUrl}" onclick="document.getElementById('modal-img-${prod.id}').src='${fotoUrl}'" class="thumb" style="width:50px; height:50px;">`;
    });
    galleryHTML += `</div>`;
  }

  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <div class="modal-product-detail">
      <div class="product-image">
        <img id="modal-img-${prod.id}" src="${fotos[0]}" alt="${prod.nombre}">
      </div>
      ${galleryHTML}
      <div class="product-content">
        <span class="product-category">${prod.categoria || ''}</span>
        <h2 style="color:#400643; margin: 10px 0;">${prod.nombre}</h2>
        <p class="product-description" style="display:block; margin-bottom: 20px;">${prod.descripcion || ''}</p>
        
        ${opcionesHTML}

        <div style="margin-top:20px;">
          <button class="btn-add-cart" style="padding:12px; font-size:15px;" onclick="enviarWhatsAppModal('${prod.id}', '${prod.nombre.replace(/'/g, "\\'")}')">
            Consultar por whatsapp
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('product-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function configurarEventosModal() {
  const modal = document.getElementById('product-modal');
  const closeBtn = document.querySelector('.close-modal');

  if (closeBtn) closeBtn.onclick = cerrarModal;

  window.onclick = function(event) {
    if (event.target === modal) cerrarModal();
  };

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') cerrarModal();
  });
}

function cerrarModal() {
  const modal = document.getElementById('product-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

// 8. Mensajes de WhatsApp
function enviarWhatsAppSimple(id, nombreProducto, event) {
  if (event) event.stopPropagation();
  const url = `https://wa.me/${TELEFONO_WSP}?text=${encodeURIComponent(`Hola! Quisiera consultar por el producto: "*\${nombreProducto}*"`)}`;
  window.open(url, '_blank');
}

function enviarWhatsAppModal(id, nombreProducto) {
  const selectColor = document.getElementById(`modal-color-${id}`);
  const selectMedida = document.getElementById(`modal-medida-${id}`);

  const color = selectColor ? selectColor.value : null;
  const medida = selectMedida ? selectMedida.value : null;

  let mensaje = `Hola! Quisiera consultar por el producto: "*${nombreProducto}*"`;
  if (color) mensaje += `\n- Color: ${color}`;
  if (medida) mensaje += `\n- Medida: ${medida}`;

  const url = `https://wa.me/${TELEFONO_WSP}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

// 9. Slider de Banners
function iniciarSlider() {
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.getElementById('slider-dots');

  if (slides.length <= 1) return;

  dotsContainer.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = `dot ${i === 0 ? 'active' : ''}`;
    dot.onclick = () => irASlide(i);
    dotsContainer.appendChild(dot);
  });

  timerSlider = setInterval(() => cambiarSlide(1), 5000);
}

function cambiarSlide(direccion) {
  const slides = document.querySelectorAll('.slide');
  if (slides.length <= 1) return;

  slides[slideIndex].classList.remove('active');
  slideIndex = (slideIndex + direccion + slides.length) % slides.length;
  slides[slideIndex].classList.add('active');

  actualizarDots();
}

function irASlide(index) {
  const slides = document.querySelectorAll('.slide');
  slides[slideIndex].classList.remove('active');
  slideIndex = index;
  slides[slideIndex].classList.add('active');
  actualizarDots();
}

function actualizarDots() {
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === slideIndex);
  });
}

// 10. Carrusel de Destacados (Flechas laterales)
function scrollearCarrusel(direccion) {
  const track = document.getElementById('catalogo-destacados');
  if (!track) return;
  const desplazar = 280 * 2 * direccion;
  track.scrollBy({ left: desplazar, behavior: 'smooth' });
}

// 11. Ordenamiento: Primero los "nuevo", el resto mezclados aleatoriamente
function ordenarNuevosPrimeros(array) {
  let arr = [...array];
  let nuevos = arr.filter(p => p.badge && String(p.badge).trim().toLowerCase() === 'nuevo');
  let otros = arr.filter(p => !p.badge || String(p.badge).trim().toLowerCase() !== 'nuevo');

  for (let i = otros.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otros[i], otros[j]] = [otros[j], otros[i]];
  }

  return [...nuevos, ...otros];
}
