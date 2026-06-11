'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Eye, Trash2, Save, X, Bold, Italic, List, Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    body: '',
    body_format: 'html'
  });

  const editorRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/documents/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/documents/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      body: '',
      body_format: 'html'
    });
    setEditingTemplate(null);
    setShowCreateModal(true);
  };

  const handleEditTemplate = (template) => {
    setFormData({
      name: template.name,
      description: template.description,
      category: template.category,
      body: template.body,
      body_format: template.body_format
    });
    setEditingTemplate(template);
    setShowCreateModal(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const url = editingTemplate
        ? `/api/documents/templates/${editingTemplate.id}`
        : '/api/documents/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        await fetchTemplates();
        setShowCreateModal(false);
        setEditingTemplate(null);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/documents/templates/${templateId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handlePreviewTemplate = (template) => {
    setPreviewTemplate(template);
  };

  const formatText = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
  };

  const insertPlaceholder = (placeholder) => {
    const text = `{{${placeholder}}}`;
    document.execCommand('insertText', false, text);
    editorRef.current?.focus();
  };

  const renderTableRow = (template) => [
    <div key="name" className="font-medium">{template.name}</div>,
    <Badge key="category" variant="secondary">{template.category}</Badge>,
    <div key="description" className="text-sm text-muted-foreground max-w-xs truncate">{template.description}</div>,
    <div key="actions" className="flex gap-1">
      <Button variant="ghost" size="sm" onClick={() => handlePreviewTemplate(template)}>
        <Eye className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleEditTemplate(template)}>
        <Edit className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:text-red-700">
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  ];

  const renderCard = (template) => (
    <Card key={template.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{template.name}</CardTitle>
          <Badge variant="secondary">{template.category}</Badge>
        </div>
        <p className="text-sm text-gray-600">{template.description}</p>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePreviewTemplate(template)}>
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleEditTemplate(template)}>
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="p-6">Loading templates...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Document Templates</h1>
          <p className="text-gray-600">Manage templates for professional document generation</p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Templates List */}
      <ResponsiveTable>
        <MobileCardTable
          headers={['Name', 'Category', 'Description', 'Actions']}
          rows={filteredTemplates}
          renderRow={renderTableRow}
          renderCard={renderCard}
          keyExtractor={(item) => item.id}
          emptyMessage="No templates found matching your criteria."
        />
      </ResponsiveTable>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </h2>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Template Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <Textarea
                placeholder="Template Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />

              {/* HTML Editor */}
              <div className="border rounded-lg">
                <div className="border-b p-2 flex gap-1 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => formatText('bold')}>
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('italic')}>
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => formatText('insertUnorderedList')}>
                    <List className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-gray-300 mx-2" />
                  <select
                    onChange={(e) => insertPlaceholder(e.target.value)}
                    className="px-2 py-1 text-sm border rounded"
                    defaultValue=""
                  >
                    <option value="" disabled>Insert Placeholder</option>
                    <option value="applicant_name">Applicant Name</option>
                    <option value="organization_name">Organization Name</option>
                    <option value="position_title">Position Title</option>
                    <option value="issue_date">Issue Date</option>
                  </select>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  className="p-4 min-h-[300px] prose max-w-none focus:outline-none"
                  dangerouslySetInnerHTML={{ __html: formData.body }}
                  onInput={(e) => setFormData(prev => ({ ...prev, body: e.currentTarget.innerHTML }))}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Template Preview: {previewTemplate.name}</h2>
              <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="border rounded-lg p-4 bg-gray-50">
              <div dangerouslySetInnerHTML={{ __html: previewTemplate.body }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}