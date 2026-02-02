/**
 * 链表数据结构实现
 * 包含：创建、插入、删除、查找、遍历、反转等操作
 */

#include <stdio.h>
#include <stdlib.h>

// 链表节点结构
typedef struct Node {
    int data;
    struct Node* next;
} Node;

// 创建新节点
Node* createNode(int data) {
    Node* newNode = (Node*)malloc(sizeof(Node));
    if (newNode == NULL) {
        printf("内存分配失败！\n");
        exit(1);
    }
    newNode->data = data;
    newNode->next = NULL;
    return newNode;
}

// 在链表头部插入
Node* insertAtHead(Node* head, int data) {
    Node* newNode = createNode(data);
    newNode->next = head;
    return newNode;
}

// 在链表尾部插入
Node* insertAtTail(Node* head, int data) {
    Node* newNode = createNode(data);
    if (head == NULL) {
        return newNode;
    }
    Node* current = head;
    while (current->next != NULL) {
        current = current->next;
    }
    current->next = newNode;
    return head;
}

// 在指定位置插入
Node* insertAtPosition(Node* head, int data, int position) {
    if (position <= 0) {
        return insertAtHead(head, data);
    }
    
    Node* newNode = createNode(data);
    Node* current = head;
    
    for (int i = 0; i < position - 1 && current != NULL; i++) {
        current = current->next;
    }
    
    if (current == NULL) {
        printf("位置超出链表长度！\n");
        free(newNode);
        return head;
    }
    
    newNode->next = current->next;
    current->next = newNode;
    return head;
}

// 删除头节点
Node* deleteAtHead(Node* head) {
    if (head == NULL) {
        printf("链表为空！\n");
        return NULL;
    }
    Node* temp = head;
    head = head->next;
    free(temp);
    return head;
}

// 删除尾节点
Node* deleteAtTail(Node* head) {
    if (head == NULL) {
        printf("链表为空！\n");
        return NULL;
    }
    if (head->next == NULL) {
        free(head);
        return NULL;
    }
    Node* current = head;
    while (current->next->next != NULL) {
        current = current->next;
    }
    free(current->next);
    current->next = NULL;
    return head;
}

// 删除指定值的节点
Node* deleteByValue(Node* head, int value) {
    if (head == NULL) {
        return NULL;
    }
    if (head->data == value) {
        Node* temp = head;
        head = head->next;
        free(temp);
        return head;
    }
    Node* current = head;
    while (current->next != NULL && current->next->data != value) {
        current = current->next;
    }
    if (current->next != NULL) {
        Node* temp = current->next;
        current->next = current->next->next;
        free(temp);
    } else {
        printf("未找到值为 %d 的节点！\n", value);
    }
    return head;
}

// 查找节点
Node* search(Node* head, int value) {
    Node* current = head;
    int position = 0;
    while (current != NULL) {
        if (current->data == value) {
            printf("找到值 %d，位置：%d\n", value, position);
            return current;
        }
        current = current->next;
        position++;
    }
    printf("未找到值 %d\n", value);
    return NULL;
}

// 获取链表长度
int getLength(Node* head) {
    int length = 0;
    Node* current = head;
    while (current != NULL) {
        length++;
        current = current->next;
    }
    return length;
}

// 反转链表
Node* reverse(Node* head) {
    Node* prev = NULL;
    Node* current = head;
    Node* next = NULL;
    
    while (current != NULL) {
        next = current->next;
        current->next = prev;
        prev = current;
        current = next;
    }
    return prev;
}

// 打印链表
void printList(Node* head) {
    printf("链表内容: ");
    Node* current = head;
    while (current != NULL) {
        printf("%d", current->data);
        if (current->next != NULL) {
            printf(" -> ");
        }
        current = current->next;
    }
    printf(" -> NULL\n");
}

// 释放链表内存
void freeList(Node* head) {
    Node* current = head;
    while (current != NULL) {
        Node* temp = current;
        current = current->next;
        free(temp);
    }
}

// 主函数 - 演示链表操作
int main() {
    Node* head = NULL;
    
    printf("===== 链表操作演示 =====\n\n");
    
    // 插入操作
    printf("【插入操作】\n");
    head = insertAtTail(head, 10);
    head = insertAtTail(head, 20);
    head = insertAtTail(head, 30);
    printf("尾部插入 10, 20, 30: ");
    printList(head);
    
    head = insertAtHead(head, 5);
    printf("头部插入 5: ");
    printList(head);
    
    head = insertAtPosition(head, 15, 2);
    printf("位置 2 插入 15: ");
    printList(head);
    
    // 链表信息
    printf("\n【链表信息】\n");
    printf("链表长度: %d\n", getLength(head));
    
    // 查找操作
    printf("\n【查找操作】\n");
    search(head, 20);
    search(head, 100);
    
    // 删除操作
    printf("\n【删除操作】\n");
    head = deleteAtHead(head);
    printf("删除头节点: ");
    printList(head);
    
    head = deleteAtTail(head);
    printf("删除尾节点: ");
    printList(head);
    
    head = deleteByValue(head, 15);
    printf("删除值为 15 的节点: ");
    printList(head);
    
    // 反转链表
    printf("\n【反转操作】\n");
    head = insertAtTail(head, 40);
    head = insertAtTail(head, 50);
    printf("添加节点后: ");
    printList(head);
    
    head = reverse(head);
    printf("反转链表: ");
    printList(head);
    
    // 释放内存
    freeList(head);
    printf("\n内存已释放，程序结束。\n");
    
    return 0;
}
