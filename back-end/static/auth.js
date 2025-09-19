
document.addEventListener('DOMContentLoaded', async () => {
    // so the info sent from client is sent to the flask server, the flask forwards it to the node.js endpoint exposed by express,
    // the ts lib proccesses the requests and sends responses through the flask server which forwards it to 
    // the clients, easy, right?
    const registerForm = document.getElementById('register-form'); 
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(registerForm);
            const username = formData.get('username');
            const password = formData.get('password');
            
        });
    }
});