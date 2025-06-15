// blog_editor.js

document.addEventListener('DOMContentLoaded', () => {
    const postsEditor = document.getElementById('posts-editor');
    const addPostBtn = document.getElementById('add-post-btn');
    // const saveChangesBtn = document.getElementById('save-changes-btn'); // Will be used later

    let blogData = {}; // To store the loaded blog.json data

    // Function to fetch blog.json
    async function loadBlogData() {
        try {
            const response = await fetch('blog.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            blogData = await response.json();
            renderPosts();
        } catch (error) {
            console.error("Error loading blog.json:", error);
            postsEditor.innerHTML = '<p>Error loading blog data. Please check the console.</p>';
        }
    }

    // Function to render forms for all posts
    function renderPosts() {
        postsEditor.innerHTML = ''; // Clear existing forms
        if (blogData.posts && blogData.posts.length > 0) {
            blogData.posts.forEach((post, index) => {
                const postForm = createPostForm(post, index);
                postsEditor.appendChild(postForm);
            });
        } else {
            postsEditor.innerHTML = '<p>No posts found in blog.json. Click "Add New Post" to start.</p>';
        }
    }

    // Function to create a form for a single post
    function createPostForm(post, index) {
        const form = document.createElement('form');
        form.className = 'post-form';
        form.dataset.index = index; // Store index for later reference

        // ID (read-only or auto-generated for new posts)
        form.appendChild(createFormField(`Post ID: ${post.id || 'New Post'}`, 'text', `posts[${index}][id]`, post.id || `post-${Date.now()}`, true)); // Read-only for now

        // Timestamp
        form.appendChild(createFormField('Timestamp:', 'datetime-local', `posts[${index}][timestamp]`, formatTimestampForInput(post.timestamp)));

        // Image (handles single string or null)
        form.appendChild(createFormField('Image URL:', 'text', `posts[${index}][image]`, post.image || ''));

        // Images (handles array of strings or null)
        const imagesContainer = document.createElement('div');
        imagesContainer.innerHTML = '<label>Image URLs (one per line):</label>';
        const imagesTextarea = document.createElement('textarea');
        imagesTextarea.name = `posts[${index}][images]`;
        imagesTextarea.value = (post.images && Array.isArray(post.images)) ? post.images.join('\n') : '';
        imagesContainer.appendChild(imagesTextarea);
        form.appendChild(imagesContainer);

        // Sport Logo
        form.appendChild(createFormField('Sport Logo URL:', 'text', `posts[${index}][sport_logo]`, post.sport_logo || ''));

        // Tags (comma-separated)
        form.appendChild(createFormField('Tags (comma-separated):', 'text', `posts[${index}][tags]`, (post.tags && Array.isArray(post.tags)) ? post.tags.join(', ') : ''));

        // Localized content (fr and en)
        ['fr', 'en'].forEach(lang => {
            const langData = post[lang] || { title: '', content: '' };
            form.appendChild(createFormField(`Title (${lang.toUpperCase()}):`, 'text', `posts[${index}][${lang}][title]`, langData.title));
            form.appendChild(createFormField(`Content (${lang.toUpperCase()}):`, 'textarea', `posts[${index}][${lang}][content]`, langData.content));
        });

        // Delete button for the post
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Delete Post';
        deleteBtn.className = 'delete-post-btn';
        deleteBtn.onclick = () => deletePost(index);
        form.appendChild(deleteBtn);

        return form;
    }

    // Helper function to create a form field (label + input)
    function createFormField(labelText, inputType, inputName, inputValue, isReadOnly = false) {
        const div = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = labelText;
        div.appendChild(label);

        let input;
        if (inputType === 'textarea') {
            input = document.createElement('textarea');
        } else {
            input = document.createElement('input');
            input.type = inputType;
        }
        input.name = inputName;
        input.value = inputValue;
        if (isReadOnly) {
            input.readOnly = true;
        }
        div.appendChild(input);
        return div;
    }

    // Helper to format ISO string to datetime-local input format
    function formatTimestampForInput(isoTimestamp) {
        if (!isoTimestamp) return '';
        try {
            const date = new Date(isoTimestamp);
            // Format: YYYY-MM-DDTHH:mm
            return date.toISOString().slice(0, 16);
        } catch (e) {
            console.warn("Error formatting timestamp:", isoTimestamp, e);
            return '';
        }
    }

    // Function to delete a post
    function deletePost(index) {
        if (confirm('Are you sure you want to delete this post?')) {
            blogData.posts.splice(index, 1);
            renderPosts(); // Re-render after deletion
            // Note: Live preview update will be handled in a later step
        }
    }

    // Function to add a new post
    addPostBtn.addEventListener('click', () => {
        const newPost = {
            id: `new-post-${Date.now()}`, // Temporary ID
            timestamp: new Date().toISOString(),
            image: null,
            images: [],
            sport_logo: '',
            tags: [],
            fr: { title: '', content: '' },
            en: { title: '', content: '' }
        };
        if (!blogData.posts) {
            blogData.posts = [];
        }
        blogData.posts.push(newPost);
        renderPosts(); // Re-render with the new post form
    });

    // Initial load
    loadBlogData();
});
