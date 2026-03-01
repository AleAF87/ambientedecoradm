// js/index.js - Sistema de Login Completo - Ambiente Decor
import { database, auth } from './firebase-config.js';
import { ref, get, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Funções utilitárias
function formatarCPF(cpf) {
    if (!cpf) return null;
    let cpfLimpo = cpf.toString().replace(/\D/g, '');
    return cpfLimpo.padStart(11, '0');
}

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    
    if (cpf.length !== 11) return false;
    
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto > 9 ? 0 : resto;
    
    if (digito1 !== parseInt(cpf.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto > 9 ? 0 : resto;
    
    return digito2 === parseInt(cpf.charAt(10));
}

function aplicarMascaraCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function aplicarMascaraCelular(celular) {
    celular = celular.replace(/\D/g, '');
    if (celular.length === 11) {
        return celular.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return celular.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

function aplicarMascaraData(data) {
    data = data.replace(/\D/g, '');
    if (data.length <= 2) {
        return data;
    } else if (data.length <= 4) {
        return data.replace(/(\d{2})(\d+)/, '$1/$2');
    } else {
        return data.replace(/(\d{2})(\d{2})(\d+)/, '$1/$2/$3').substring(0, 10);
    }
}

function validarData(data) {
    if (!data) return false;
    
    const partes = data.split('/');
    if (partes.length !== 3) return false;
    
    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1;
    const ano = parseInt(partes[2]);
    
    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
    
    const dataObj = new Date(ano, mes, dia);
    
    return dataObj.getDate() === dia && 
           dataObj.getMonth() === mes && 
           dataObj.getFullYear() === ano &&
           dataObj <= new Date(); // Não permite data futura
}

function formatarDataBR(data) {
    if (!data) return '';
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function formatarDataISO(data) {
    if (!data) return '';
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function dataStringParaObjeto(dataStr) {
    if (!dataStr) return null;
    const partes = dataStr.split('/');
    if (partes.length !== 3) return null;
    
    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1;
    const ano = parseInt(partes[2]);
    
    const data = new Date(ano, mes, dia);
    
    if (data.getDate() !== dia || data.getMonth() !== mes || data.getFullYear() !== ano) {
        return null;
    }
    
    return data;
}

// Variáveis globais
let userCPF = '';
let userEmail = '';
let userFullName = '';
let userNivel = null;
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let yearSelectOpen = false;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM - Login
    const cpfInput = document.getElementById('cpfInput');
    const searchCpfBtn = document.getElementById('searchCpfBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const passwordStep = document.getElementById('passwordStep');
    const cpfStep = document.getElementById('cpfStep');
    const userNameSpan = document.getElementById('userName');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const backBtn = document.getElementById('backBtn');
    const togglePassword = document.getElementById('togglePassword');
    const forgotPassword = document.getElementById('forgotPassword');
    const errorAlert = document.getElementById('errorAlert');
    const infoAlert = document.getElementById('infoAlert');

    // Elementos DOM - Modal Registro
    const registerModal = document.getElementById('registerModal');
    const registerCpf = document.getElementById('registerCpf');
    const cpfStatus = document.getElementById('cpfStatus');
    const cpfSpinner = document.getElementById('cpfSpinner');
    const registerNome = document.getElementById('registerNome');
    const registerDataNasc = document.getElementById('registerDataNasc');
    const registerCelular = document.getElementById('registerCelular');
    const registerEmail = document.getElementById('registerEmail');
    const registerSenha = document.getElementById('registerSenha');
    const registerConfirmarSenha = document.getElementById('registerConfirmarSenha');
    const btnCriarConta = document.getElementById('btnCriarConta');
    const openCalendarBtn = document.getElementById('openCalendarBtn');

    // ===== CORREÇÕES: Verificar se elementos existem antes de adicionar listeners =====
    
    // Máscara para CPF no passo 1
    if (cpfInput) {
        cpfInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 11);
        });
    }

    // Máscara para data de nascimento
    if (registerDataNasc) {
        registerDataNasc.addEventListener('input', function(e) {
            if (!registerDataNasc.disabled) {
                this.value = aplicarMascaraData(this.value);
                
                if (this.value.length === 10) {
                    const dataObj = dataStringParaObjeto(this.value);
                    if (dataObj && validarData(this.value)) {
                        selectedDate = dataObj;
                        this.classList.remove('is-invalid');
                        this.classList.add('is-valid');
                    } else {
                        selectedDate = null;
                        this.classList.remove('is-valid');
                        this.classList.add('is-invalid');
                    }
                } else {
                    selectedDate = null;
                    this.classList.remove('is-valid', 'is-invalid');
                }
                
                verificarFormularioCompleto();
            }
        });
    }

    // Evento para abrir calendário
    if (openCalendarBtn) {
        openCalendarBtn.addEventListener('click', function() {
            if (!registerNome.disabled) {
                abrirCalendario();
            }
        });
    }

    // Buscar CPF existente
    if (searchCpfBtn) {
        searchCpfBtn.addEventListener('click', async function() {
            const cpf = cpfInput.value.trim();
            
            if (cpf.length !== 11) {
                showError('Por favor, digite um CPF válido de 11 dígitos.');
                return;
            }

            userCPF = formatarCPF(cpf);
            
            searchCpfBtn.disabled = true;
            searchCpfBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Buscando...';

            try {
                // Busca diretamente em /usuarios/{cpf}
                const usuarioRef = ref(database, `usuarios/${userCPF}`);
                const snapshot = await get(usuarioRef);

                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    userEmail = userData.email;
                    userFullName = userData.nome;
                    userNivel = userData.nivel;
                    
                    if (!userEmail) {
                        showError('Email não configurado para este CPF.');
                        return;
                    }
                    
                    // Verifica se o nível é 0 (pendente)
                    if (userNivel === 0) {
                        showError('Seu cadastro ainda está pendente de aprovação. Aguarde liberação do administrador. Se estiver demorando, entre em contato.');
                        searchCpfBtn.disabled = false;
                        searchCpfBtn.innerHTML = '<i class="fas fa-search me-2"></i>Verificar CPF';
                        return;
                    }
                    
                    forgotPassword.classList.remove('d-none');
                    userNameSpan.textContent = userFullName;
                    cpfStep.classList.remove('active');
                    passwordStep.classList.add('active');
                    setTimeout(() => passwordInput.focus(), 300);
                } else {
                    showInfo('CPF não encontrado. Deseja se cadastrar?');
                }
            } catch (error) {
                console.error('Erro ao buscar CPF:', error);
                showError('Erro ao buscar usuário. Tente novamente.');
            } finally {
                searchCpfBtn.disabled = false;
                searchCpfBtn.innerHTML = '<i class="fas fa-search me-2"></i>Verificar CPF';
            }
        });
    }

    // Abrir modal de cadastro
    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', function() {
            registerModal.style.display = 'flex';
            registerCpf.focus();
        });
    }

    // Fechar modal
    window.fecharModalRegistro = function() {
        registerModal.style.display = 'none';
        resetRegisterForm();
    };

    // Fechar modal com X
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', fecharModalRegistro);
    }

    // Máscara e validação CPF em tempo real
    let cpfTimeout;
    if (registerCpf) {
        registerCpf.addEventListener('input', async function() {
            let cpf = this.value.replace(/\D/g, '').slice(0, 11);
            this.value = aplicarMascaraCPF(cpf);
            
            clearTimeout(cpfTimeout);
            
            if (cpf.length === 11) {
                if (!validarCPF(cpf)) {
                    cpfStatus.innerHTML = '<span class="text-danger">❌ CPF inválido</span>';
                    bloquearCamposRegistro(true);
                    return;
                }
                
                cpfSpinner.classList.remove('d-none');
                
                cpfTimeout = setTimeout(async () => {
                    try {
                        const cpfFormatado = formatarCPF(cpf);
                        // Verifica em /usuarios/{cpf} se já existe
                        const usuarioRef = ref(database, `usuarios/${cpfFormatado}`);
                        const snapshot = await get(usuarioRef);
                        
                        cpfSpinner.classList.add('d-none');
                        
                        if (snapshot.exists()) {
                            cpfStatus.innerHTML = '<span class="text-danger">❌ CPF já cadastrado</span>';
                            bloquearCamposRegistro(true);
                        } else {
                            cpfStatus.innerHTML = '<span class="text-success">✓ CPF disponível</span>';
                            bloquearCamposRegistro(false);
                        }
                    } catch (error) {
                        console.error('Erro ao verificar CPF:', error);
                        cpfSpinner.classList.add('d-none');
                        cpfStatus.innerHTML = '<span class="text-danger">Erro ao verificar CPF</span>';
                    }
                }, 500);
            } else {
                cpfStatus.innerHTML = '';
                bloquearCamposRegistro(true);
            }
        });
    }

    // Máscara celular
    if (registerCelular) {
        registerCelular.addEventListener('input', function() {
            this.value = aplicarMascaraCelular(this.value);
        });
    }

    // Validação de senha em tempo real
    function validarSenha(senha) {
        const requisitos = {
            length: senha.length >= 8,
            upper: /[A-Z]/.test(senha),
            lower: /[a-z]/.test(senha),
            number: /[0-9]/.test(senha),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(senha)
        };
        
        const reqLength = document.getElementById('reqLength');
        const reqUpper = document.getElementById('reqUpper');
        const reqLower = document.getElementById('reqLower');
        const reqNumber = document.getElementById('reqNumber');
        const reqSpecial = document.getElementById('reqSpecial');
        
        if (reqLength) reqLength.innerHTML = requisitos.length ? '✅ Mínimo 8 caracteres' : '❌ Mínimo 8 caracteres';
        if (reqUpper) reqUpper.innerHTML = requisitos.upper ? '✅ 1 letra maiúscula' : '❌ 1 letra maiúscula';
        if (reqLower) reqLower.innerHTML = requisitos.lower ? '✅ 1 letra minúscula' : '❌ 1 letra minúscula';
        if (reqNumber) reqNumber.innerHTML = requisitos.number ? '✅ 1 número' : '❌ 1 número';
        if (reqSpecial) reqSpecial.innerHTML = requisitos.special ? '✅ 1 caractere especial' : '❌ 1 caractere especial';
        
        return Object.values(requisitos).every(v => v);
    }

    if (registerSenha) {
        registerSenha.addEventListener('input', function() {
            validarSenha(this.value);
            verificarSenhas();
        });
    }

    if (registerConfirmarSenha) {
        registerConfirmarSenha.addEventListener('input', verificarSenhas);
    }

    function verificarSenhas() {
        const senha = registerSenha ? registerSenha.value : '';
        const confirmar = registerConfirmarSenha ? registerConfirmarSenha.value : '';
        const mismatch = document.getElementById('passwordMismatch');
        const match = document.getElementById('passwordMatch');
        
        if (confirmar.length > 0 && mismatch && match) {
            if (senha === confirmar) {
                mismatch.classList.add('d-none');
                match.classList.remove('d-none');
            } else {
                mismatch.classList.remove('d-none');
                match.classList.add('d-none');
            }
        } else {
            if (mismatch) mismatch.classList.add('d-none');
            if (match) match.classList.add('d-none');
        }
    }

    // ===== CORREÇÃO CRÍTICA: Função bloquearCamposRegistro =====
    function bloquearCamposRegistro(bloquear) {
        const campos = [
            registerNome, registerDataNasc, registerCelular, 
            registerEmail, registerSenha, registerConfirmarSenha,
            openCalendarBtn
        ];
        
        campos.forEach(campo => {
            if (campo) {
                campo.disabled = bloquear;
                // CORREÇÃO: Se NÃO for bloquear, garantir que o campo seja habilitado
                if (!bloquear && campo !== openCalendarBtn) {
                    // Não precisa fazer nada extra, apenas garantir que disabled = false
                }
            }
        });
        
        if (btnCriarConta) btnCriarConta.disabled = true;
    }

    // Verificar se todos os campos estão válidos para habilitar botão
    function verificarFormularioCompleto() {
        if (!registerNome || !registerDataNasc || !registerCelular || !registerEmail || !registerSenha || !registerConfirmarSenha) {
            return;
        }
        
        const dataValida = registerDataNasc.value.length === 10 && validarData(registerDataNasc.value);
        
        const camposPreenchidos = 
            registerNome.value &&
            (selectedDate || dataValida) &&
            registerCelular.value &&
            registerEmail.value &&
            registerSenha.value &&
            registerConfirmarSenha.value;
        
        const senhasValidas = registerSenha.value === registerConfirmarSenha.value && 
                             validarSenha(registerSenha.value);
        
        const cpfValido = cpfStatus && cpfStatus.innerHTML.includes('CPF disponível');
        
        if (btnCriarConta) {
            btnCriarConta.disabled = !(camposPreenchidos && senhasValidas && cpfValido);
        }
    }

    const camposRegistro = [registerNome, registerDataNasc, registerCelular, registerEmail, registerSenha, registerConfirmarSenha];
    camposRegistro.forEach(campo => {
        if (campo) {
            campo.addEventListener('input', verificarFormularioCompleto);
        }
    });

    // Submit do formulário de cadastro
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const cpf = formatarCPF(registerCpf.value);
            const email = registerEmail.value;
            const senha = registerSenha.value;
            const nome = registerNome.value;
            
            let dataNascimento;
            if (selectedDate) {
                dataNascimento = formatarDataISO(selectedDate);
            } else if (registerDataNasc.value.length === 10) {
                const dataObj = dataStringParaObjeto(registerDataNasc.value);
                dataNascimento = formatarDataISO(dataObj);
            }
            
            btnCriarConta.disabled = true;
            btnCriarConta.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Criando conta...';
            
            try {
                // Criar usuário no Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
                
                const timestamp = new Date().toISOString();
                
                // Criar nó em /usuarios/{cpf}
                await set(ref(database, `usuarios/${cpf}`), {
                    nome: nome,
                    telefone: registerCelular.value,
                    dataNascimento: dataNascimento,
                    empresa: '',
                    email: email,
                    nivel: 0,
                    criadoEm: timestamp,
                    authUid: userCredential.user.uid
                });
                
                // Criar nó em /pendenteUsuario/{cpf}
                await set(ref(database, `pendenteUsuario/${cpf}`), {
                    criadoEm: timestamp
                });
                
                showInfo('Cadastro realizado com sucesso. Aguarde liberação do administrador. Se estiver demorando, entre em contato.');
                fecharModalRegistro();
                
            } catch (error) {
                console.error('Erro ao criar conta:', error);
                let mensagem = 'Erro ao criar conta. ';
                
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        mensagem += 'E-mail já está em uso.';
                        break;
                    case 'auth/invalid-email':
                        mensagem += 'E-mail inválido.';
                        break;
                    case 'auth/weak-password':
                        mensagem += 'Senha muito fraca.';
                        break;
                    default:
                        mensagem += error.message;
                }
                
                showError(mensagem);
            } finally {
                btnCriarConta.disabled = false;
                btnCriarConta.innerHTML = 'Criar Conta';
            }
        });
    }

    function resetRegisterForm() {
        if (registerCpf) registerCpf.value = '';
        if (registerNome) registerNome.value = '';
        if (registerDataNasc) registerDataNasc.value = '';
        if (registerCelular) registerCelular.value = '';
        if (registerEmail) registerEmail.value = '';
        if (registerSenha) registerSenha.value = '';
        if (registerConfirmarSenha) registerConfirmarSenha.value = '';
        if (cpfStatus) cpfStatus.innerHTML = '';
        selectedDate = null;
        currentMonth = new Date().getMonth();
        currentYear = new Date().getFullYear();
        
        bloquearCamposRegistro(true);
    }

    if (backBtn) {
        backBtn.addEventListener('click', function() {
            passwordStep.classList.remove('active');
            cpfStep.classList.add('active');
            passwordInput.value = '';
            cpfInput.focus();
            forgotPassword.classList.add('d-none');
            
            userCPF = '';
            userEmail = '';
            userFullName = '';
            userNivel = null;
        });
    }

    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const password = passwordInput.value.trim();
            
            if (!password) {
                showError('Por favor, digite sua senha.');
                return;
            }

            if (!userEmail) {
                showError('Erro interno: email não encontrado.');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Entrando...';

            try {
                const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);

                // SALVAR APENAS CPF
                sessionStorage.setItem('userCPF', userCPF);
                sessionStorage.setItem('userName', userFullName);
                
                localStorage.setItem('userCPF', userCPF);
                localStorage.setItem('userName', userFullName);

                console.log('✅ Login realizado. CPF salvo:', userCPF);
                
                window.location.href = 'app.html';
                
            } catch (error) {
                console.error('Erro de login:', error);
                
                let errorMessage = 'Erro ao fazer login. ';
                
                switch (error.code) {
                    case 'auth/invalid-credential':
                    case 'auth/wrong-password':
                    case 'auth/invalid-login-credentials':
                        errorMessage += 'Senha incorreta.';
                        break;
                    case 'auth/user-not-found':
                        errorMessage += 'Usuário não encontrado.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage += 'Muitas tentativas. Tente novamente mais tarde.';
                        break;
                    default:
                        errorMessage += error.message;
                }
                
                showError(errorMessage);
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Entrar';
            }
        });
    }

    if (forgotPassword) {
        forgotPassword.addEventListener('click', async function(e) {
            e.preventDefault();
            
            if (!userEmail) {
                showInfo('Por favor, verifique seu CPF primeiro.');
                return;
            }
            
            try {
                await sendPasswordResetEmail(auth, userEmail);
                showInfo(`E-mail de recuperação enviado para: ${userEmail}`);
            } catch (error) {
                console.error('Erro ao recuperar senha:', error);
                showError('Erro ao enviar e-mail de recuperação.');
            }
        });
    }

    if (cpfInput) {
        cpfInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchCpfBtn.click();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }

    function showError(message) {
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.classList.remove('d-none');
            infoAlert.classList.add('d-none');
            setTimeout(() => errorAlert.classList.add('d-none'), 5000);
        }
    }

    function showInfo(message) {
        if (infoAlert) {
            infoAlert.textContent = message;
            infoAlert.classList.remove('d-none');
            errorAlert.classList.add('d-none');
            setTimeout(() => infoAlert.classList.add('d-none'), 5000);
        }
    }
});

// Funções do calendário
function abrirCalendario() {
    const calendarModal = document.getElementById('calendarModal');
    if (calendarModal) {
        calendarModal.style.display = 'flex';
        yearSelectOpen = false;
        renderizarCalendario();
    }
}

window.fecharCalendarModal = function() {
    const calendarModal = document.getElementById('calendarModal');
    if (calendarModal) {
        calendarModal.style.display = 'none';
    }
};

window.toggleYearSelect = function() {
    yearSelectOpen = !yearSelectOpen;
    renderizarCalendario();
};

window.selecionarAno = function(ano) {
    currentYear = ano;
    yearSelectOpen = false;
    renderizarCalendario();
};

window.mudarMes = function(direcao) {
    currentMonth += direcao;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderizarCalendario();
};

window.selecionarData = function(ano, mes, dia) {
    selectedDate = new Date(ano, mes, dia);
    const registerDataNasc = document.getElementById('registerDataNasc');
    if (registerDataNasc) {
        registerDataNasc.value = formatarDataBR(selectedDate);
    }
    fecharCalendarModal();
    
    const registerNome = document.getElementById('registerNome');
    if (registerNome) {
        registerNome.dispatchEvent(new Event('input'));
    }
};

function gerarAnos() {
    const anoAtual = new Date().getFullYear();
    const anos = [];
    for (let ano = anoAtual; ano >= 1900; ano--) {
        anos.push(ano);
    }
    return anos;
}

function renderizarCalendario() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    let html = '';
    
    if (yearSelectOpen) {
        const anos = gerarAnos();
        html = `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="btn btn-outline-secondary btn-sm" onclick="toggleYearSelect()">
                        <i class="fas fa-arrow-left"></i> Voltar
                    </button>
                    <span class="calendar-month-year">Selecione o Ano</span>
                    <div></div>
                </div>
                
                <div class="year-grid">
        `;
        
        anos.forEach(ano => {
            const isSelected = ano === currentYear;
            html += `
                <div class="year-item ${isSelected ? 'selected' : ''}" onclick="selecionarAno(${ano})">
                    ${ano}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    } else {
        const primeiroDia = new Date(currentYear, currentMonth, 1);
        const ultimoDia = new Date(currentYear, currentMonth + 1, 0);
        
        const diasNoMes = ultimoDia.getDate();
        const diaSemanaInicio = primeiroDia.getDay();
        
        html = `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="btn btn-outline-secondary btn-sm" onclick="mudarMes(-1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <div class="month-year-selector" onclick="toggleYearSelect()">
                        <span class="calendar-month">${meses[currentMonth]}</span>
                        <span class="calendar-year">${currentYear}</span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <button class="btn btn-outline-secondary btn-sm" onclick="mudarMes(1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">Dom</div>
                    <div class="calendar-weekday">Seg</div>
                    <div class="calendar-weekday">Ter</div>
                    <div class="calendar-weekday">Qua</div>
                    <div class="calendar-weekday">Qui</div>
                    <div class="calendar-weekday">Sex</div>
                    <div class="calendar-weekday">Sáb</div>
                </div>
                
                <div class="calendar-days">
        `;
        
        for (let i = 0; i < diaSemanaInicio; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        const hoje = new Date();
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const dataAtual = new Date(currentYear, currentMonth, dia);
            const isHoje = dataAtual.toDateString() === hoje.toDateString();
            const isSelected = selectedDate && dataAtual.toDateString() === selectedDate.toDateString();
            const isFuture = dataAtual > hoje;
            
            let classes = 'calendar-day';
            if (isHoje) classes += ' today';
            if (isSelected) classes += ' selected';
            if (isFuture) classes += ' disabled';
            
            html += `<div class="${classes}" onclick="${!isFuture ? 'selecionarData(' + currentYear + ',' + currentMonth + ',' + dia + ')' : ''}">${dia}</div>`;
        }
        
        html += `
                </div>
                
                <div class="calendar-footer">
                    <div class="calendar-actions">
                        <button class="btn btn-outline-secondary" onclick="fecharCalendarModal()">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ========== EFEITOS VISUAIS (MANTIDOS SEUS) ==========
function criarParticulas() {
    const container = document.querySelector('.login-container');
    if (!container) return;
    
    // Remover partículas existentes
    const particlesContainer = document.querySelector('.floating-particles');
    if (particlesContainer) {
        particlesContainer.remove();
    }
    
    // Criar container de partículas
    const particlesDiv = document.createElement('div');
    particlesDiv.className = 'floating-particles';
    
    // Criar 50 partículas
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Posição aleatória
        particle.style.left = Math.random() * 100 + '%';
        particle.style.width = (2 + Math.random() * 8) + 'px';
        particle.style.height = particle.style.width;
        
        // Cor baseada no marrom
        const opacidade = 0.1 + Math.random() * 0.2;
        particle.style.background = `rgba(210, 180, 140, ${opacidade})`;
        
        // Animação aleatória
        particle.style.animationDelay = Math.random() * 10 + 's';
        particle.style.animationDuration = (8 + Math.random() * 12) + 's';
        
        particlesDiv.appendChild(particle);
    }
    
    container.appendChild(particlesDiv);
}

function criarOndas() {
    const container = document.querySelector('.login-container');
    if (!container) return;
    
    // Remover ondas existentes
    const wavesContainer = document.querySelector('.waves');
    if (wavesContainer) {
        wavesContainer.remove();
    }
    
    const wavesDiv = document.createElement('div');
    wavesDiv.className = 'waves';
    
    const wave1 = document.createElement('div');
    wave1.className = 'wave';
    wave1.style.background = 'linear-gradient(180deg, transparent, rgba(210, 180, 140, 0.2))';
    wavesDiv.appendChild(wave1);
    
    const wave2 = document.createElement('div');
    wave2.className = 'wave wave-2';
    wave2.style.background = 'linear-gradient(180deg, transparent, rgba(210, 180, 140, 0.15))';
    wavesDiv.appendChild(wave2);
    
    container.appendChild(wavesDiv);
}

function criarCirculos() {
    const container = document.querySelector('.login-container');
    if (!container) return;
    
    // Remover círculos existentes
    const circlesContainer = document.querySelector('.circles');
    if (circlesContainer) {
        circlesContainer.remove();
    }
    
    const circlesDiv = document.createElement('div');
    circlesDiv.className = 'circles';
    
    const circle1 = document.createElement('div');
    circle1.className = 'circle circle-1';
    circle1.style.borderColor = 'rgba(210, 180, 140, 0.15)';
    circlesDiv.appendChild(circle1);
    
    const circle2 = document.createElement('div');
    circle2.className = 'circle circle-2';
    circle2.style.borderColor = 'rgba(210, 180, 140, 0.1)';
    circlesDiv.appendChild(circle2);
    
    const circle3 = document.createElement('div');
    circle3.className = 'circle circle-3';
    circle3.style.borderColor = 'rgba(210, 180, 140, 0.05)';
    circlesDiv.appendChild(circle3);
    
    container.appendChild(circlesDiv);
}

function criarBrilho() {
    const container = document.querySelector('.login-container');
    if (!container) return;
    
    // Remover brilho existente
    const shimmerDiv = document.querySelector('.shimmer');
    if (shimmerDiv) {
        shimmerDiv.remove();
    }
    
    const brilho = document.createElement('div');
    brilho.className = 'shimmer';
    brilho.style.background = 'radial-gradient(circle at 50% 50%, rgba(210, 180, 140, 0.15) 0%, transparent 60%)';
    container.appendChild(brilho);
}

function criarLinhas() {
    const container = document.querySelector('.login-container');
    if (!container) return;
    
    // Remover linhas existentes
    const goldLines = document.querySelector('.gold-lines');
    if (goldLines) {
        goldLines.remove();
    }
    
    const goldLinesDiv = document.createElement('div');
    goldLinesDiv.className = 'gold-lines';
    
    for (let i = 1; i <= 3; i++) {
        const linha = document.createElement('div');
        linha.className = `gold-line line-${i}`;
        linha.style.background = 'linear-gradient(90deg, transparent, rgba(210, 180, 140, 0.4), transparent)';
        goldLinesDiv.appendChild(linha);
    }
    
    container.appendChild(goldLinesDiv);
}

// Inicializar todos os efeitos
function inicializarEfeitos() {
    if (document.querySelector('.login-container')) {
        criarParticulas();
        criarOndas();
        criarCirculos();
        criarBrilho();
        criarLinhas();
    }
}

// Chamar a função quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    inicializarEfeitos();
    
    // Recriar efeitos a cada 30 segundos (para renovar as partículas)
    setInterval(() => {
        if (document.querySelector('.login-container')) {
            criarParticulas();
        }
    }, 30000);
});

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const registerModal = document.getElementById('registerModal');
    const calendarModal = document.getElementById('calendarModal');
    
    if (event.target === registerModal) {
        fecharModalRegistro();
    }
    if (event.target === calendarModal) {
        fecharCalendarModal();
    }
};

// Exportar funções necessárias
export {
    formatarCPF,
    validarCPF,
    aplicarMascaraCPF,
    aplicarMascaraCelular,
    aplicarMascaraData
};