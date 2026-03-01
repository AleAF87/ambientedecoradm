// js/auth-check.js - Verificação de Autenticação com CPF
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { database } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Função utilitária para formatar CPF (garantir 11 dígitos)
function formatarCPF(cpf) {
    if (!cpf) return null;
    let cpfLimpo = cpf.toString().replace(/\D/g, '');
    return cpfLimpo.padStart(11, '0');
}

// Verificar autenticação e nível de acesso
export function checkAuth(requiredLevel = 3) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.log('❌ Usuário não autenticado');
                window.location.href = 'index.html';
                return;
            }

            try {
                // 1. PEGAR SOMENTE O CPF DO SESSION STORAGE
                let userCPF = sessionStorage.getItem('userCPF');
                
                if (!userCPF) {
                    // Se não achou no session, tenta no localStorage como fallback
                    userCPF = localStorage.getItem('userCPF');
                }
                
                if (!userCPF) {
                    console.error('❌ CPF não encontrado no storage');
                    throw new Error('CPF não encontrado');
                }

                // 2. FORMATAR CPF (garantir 11 dígitos)
                userCPF = formatarCPF(userCPF);
                
                console.log('🔍 Verificando acesso para CPF:', userCPF);

                // 3. BUSCAR DADOS DO USUÁRIO EM /usuarios/{cpf}
                const usuarioRef = ref(database, `usuarios/${userCPF}`);
                const snapshot = await get(usuarioRef);

                if (!snapshot.exists()) {
                    console.error('❌ Usuário não encontrado em /usuarios/');
                    throw new Error('Dados do usuário não encontrados');
                }

                const userData = snapshot.val();
                console.log('✅ Dados encontrados:', {
                    nome: userData.nome,
                    nivel: userData.nivel,
                    email: userData.email
                });
                
                const userLevel = userData.nivel || 3;
                
                // 4. SALVAR O NÍVEL NO SESSION STORAGE
                sessionStorage.setItem('userNivel', userLevel);
                sessionStorage.setItem('currentUserLevel', userLevel);
                
                // 5. VERIFICAR SE USUÁRIO ESTÁ PENDENTE
                if (userLevel === 0) {
                    alert('❌ Seu cadastro ainda está pendente de aprovação.\n\nAguarde liberação do administrador.');
                    await auth.signOut();
                    clearUserData();
                    window.location.href = 'index.html';
                    reject(new Error('Usuário pendente de aprovação'));
                    return;
                }
                
                // 6. VERIFICAR NÍVEL DE ACESSO (se necessário)
                if (requiredLevel < 3 && userLevel > requiredLevel) {
                    console.log(`🚫 Nível insuficiente: usuário ${userLevel}, necessário ${requiredLevel}`);
                    
                    alert(`🚫 Acesso Negado!\n\nSeu nível de acesso (${userLevel}) não permite esta página.\nNível necessário: ${requiredLevel}`);
                    
                    // Redirecionar para dashboard
                    if (window.location.pathname.includes('app.html')) {
                        if (window.app && window.app.loadPage) {
                            window.app.loadPage('dashboard.html');
                        } else {
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                    
                    reject(new Error(`Nível insuficiente: ${userLevel} < ${requiredLevel}`));
                    return;
                }
                
                // 7. TUDO OK! Resolver com os dados
                resolve({ 
                    user, 
                    userData, 
                    cpf: userCPF
                });
                
            } catch (error) {
                console.error('💥 Erro ao verificar acesso:', error.message);
                
                if (!error.message.includes('Nível insuficiente') && 
                    !error.message.includes('pendente')) {
                    alert('Erro ao verificar permissões. Faça login novamente.');
                    clearUserData();
                    window.location.href = 'index.html';
                }
                reject(error);
            }
        });
    });
}

// Limpar dados do usuário
function clearUserData() {
    sessionStorage.removeItem('userCPF');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userNivel');
    sessionStorage.removeItem('currentUserLevel');
    localStorage.removeItem('userCPF');
    localStorage.removeItem('userName');
}

// Carregar navbar
export async function loadNavbar() {
    const existingNavbar = document.getElementById('navbar');
    if (existingNavbar && existingNavbar.innerHTML.trim() !== '') {
        console.log('✅ Navbar já carregada');
        return true;
    }
    
    let navbarElement = document.getElementById('navbar');
    if (!navbarElement) {
        navbarElement = document.createElement('div');
        navbarElement.id = 'navbar';
        document.body.insertBefore(navbarElement, document.body.firstChild);
    }
    
    try {
        const response = await fetch('components/navbar.html');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const html = await response.text();
        
        if (navbarElement.innerHTML.trim() === '') {
            navbarElement.innerHTML = html;
            console.log('✅ Navbar carregada no DOM');
        }
        
        // Aguardar um pouco e depois esconder itens por nível
        setTimeout(() => {
            setTimeout(hideNavbarItemsByLevel, 200);
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar navbar:', error.message);
        
        if (!navbarElement.innerHTML.trim()) {
            navbarElement.innerHTML = createFallbackNavbar();
        }
        
        return false;
    }
}

// Esconder itens da navbar baseado no nível do usuário
async function hideNavbarItemsByLevel() {
    try {
        let userLevel = sessionStorage.getItem('userNivel');
        
        if (!userLevel) {
            let userCPF = sessionStorage.getItem('userCPF');
            if (!userCPF) return;
            
            const usuarioRef = ref(database, `usuarios/${userCPF}`);
            const snapshot = await get(usuarioRef);
            
            if (!snapshot.exists()) return;
            
            const userData = snapshot.val();
            userLevel = userData.nivel || 3;
            sessionStorage.setItem('userNivel', userLevel);
            sessionStorage.setItem('currentUserLevel', userLevel);
        }
        
        console.log(`🎯 Ajustando navbar para nível ${userLevel}...`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Converter para número
        userLevel = parseInt(userLevel);
        
        // Nível 3 (usuário normal) - esconder itens restritos
        if (userLevel >= 3) {
            // Esconder Solicitações (se existir)
            hideElement('#navSolicitacoes');
            
            // Esconder Exclusões (se existir)
            hideElement('#navExclusoes');
        }
        
    } catch (error) {
        console.error('❌ Erro ao ajustar navbar:', error);
        setTimeout(hideNavbarItemsByLevel, 1000);
    }
}

// Função auxiliar para esconder elemento
function hideElement(selector, retryCount = 0) {
    const element = document.querySelector(selector);
    if (element) {
        const parentLi = element.closest('li.nav-item');
        if (parentLi) {
            parentLi.style.display = 'none';
            console.log(`👁️ Ocultando menu: ${selector}`);
            return true;
        }
    }
    
    // Se não encontrou, tenta novamente (máx 3 tentativas)
    if (retryCount < 3) {
        setTimeout(() => hideElement(selector, retryCount + 1), 500);
    }
    
    return false;
}

// Navbar de fallback
function createFallbackNavbar() {
    return `
        <nav class="navbar navbar-dark bg-marrom-escuro fixed-top">
            <div class="container-fluid">
                <span class="navbar-brand">
                    <img src="img/logo.png" alt="Ambiente Decor" style="height: 35px; margin-right: 10px;" onerror="this.style.display='none'">
                    Ambiente Decor
                </span>
                <div class="d-flex">
                    <button class="btn btn-outline-light me-2" onclick="window.location.href='dashboard.html'">
                        <i class="fas fa-home"></i>
                    </button>
                    <button class="btn btn-outline-light" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
        </nav>
    `;
}

// Função de logout global
window.logout = function() {
    clearUserData();
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Erro ao fazer logout:', error);
        window.location.href = 'index.html';
    });
};

// Função para obter dados do usuário atual
export async function getCurrentUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                reject(new Error('Usuário não autenticado'));
                return;
            }
            
            try {
                let userCPF = sessionStorage.getItem('userCPF');
                
                if (!userCPF) {
                    userCPF = localStorage.getItem('userCPF');
                }
                
                if (!userCPF) {
                    throw new Error('CPF não encontrado');
                }
                
                userCPF = formatarCPF(userCPF);
                
                const usuarioRef = ref(database, `usuarios/${userCPF}`);
                const snapshot = await get(usuarioRef);
                
                if (!snapshot.exists()) {
                    throw new Error('Usuário não encontrado');
                }
                
                resolve({
                    user,
                    data: snapshot.val(),
                    cpf: userCPF
                });
                
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Exportar funções
export default {
    checkAuth,
    loadNavbar,
    getCurrentUser,
    clearUserData
};